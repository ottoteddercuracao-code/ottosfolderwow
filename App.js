import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const OPSLAG_SLEUTEL = 'doeltracker-v1';
/** @typedef {{ id: string, naam: string, afstand: number, beschrijving: string, minuten: number, datum: string }} Training */

const vandaag = () => new Date().toLocaleDateString('nl-NL');

/** @param {string} tekst */
function leesDatum(tekst) {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(tekst.trim());
  if (!match) return null;
  const [, dag, maand, jaar] = match.map(Number);
  const datum = new Date(jaar, maand - 1, dag, 12);
  return datum.getFullYear() === jaar && datum.getMonth() === maand - 1 && datum.getDate() === dag ? datum : null;
}

/** @param {Date} datum */
function weekStart(datum) {
  const maandag = new Date(datum);
  maandag.setHours(0, 0, 0, 0);
  maandag.setDate(maandag.getDate() - (maandag.getDay() + 6) % 7);
  return maandag;
}

/** @param {Training} training @param {Date} start */
function inWeek(training, start) {
  const datum = leesDatum(training.datum);
  const einde = new Date(start);
  einde.setDate(einde.getDate() + 7);
  return datum && datum >= start && datum < einde;
}

/** @param {{ tekst: string, onPress: () => void, subtiel?: boolean }} props */
function Knop({ tekst, onPress, subtiel = false }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.knop, subtiel && styles.subtiel, pressed && { opacity: 0.7 }]}><Text style={[styles.knopTekst, subtiel && styles.subtielTekst]}>{tekst}</Text></Pressable>;
}

export default function App() {
  const [trainingen, zetTrainingen] = useState(/** @type {Training[]} */ ([]));
  const [doel, zetDoel] = useState(10);
  const [doelInvoer, zetDoelInvoer] = useState('10');
  const [naam, zetNaam] = useState('Roeien');
  const [afstand, zetAfstand] = useState('');
  const [beschrijving, zetBeschrijving] = useState('');
  const [minuten, zetMinuten] = useState('');
  const [datumInvoer, zetDatumInvoer] = useState(vandaag);
  const [formulier, zetFormulier] = useState(false);
  const [doelBewerken, zetDoelBewerken] = useState(false);
  const [fout, zetFout] = useState('');
  const [installatieHulp, zetInstallatieHulp] = useState(false);
  const [geladen, zetGeladen] = useState(false);
  const [opslagStatus, zetOpslagStatus] = useState('Gegevens laden…');
  const schrijfWachtrij = useRef(Promise.resolve());

  useEffect(() => {
    let actief = true;
    AsyncStorage.getItem(OPSLAG_SLEUTEL).then(tekst => {
      if (!actief) return;
      if (tekst) {
        /** @type {{ doel: number, trainingen: Training[] }} */
        const gegevens = JSON.parse(tekst);
        if (!Number.isInteger(gegevens.doel) || gegevens.doel < 1 || gegevens.doel > 1000 || !Array.isArray(gegevens.trainingen) || !gegevens.trainingen.every(training => typeof training.id === 'string' && typeof training.naam === 'string' && typeof training.beschrijving === 'string' && typeof training.datum === 'string' && leesDatum(training.datum) && Number.isFinite(training.afstand) && training.afstand > 0 && Number.isInteger(training.minuten) && training.minuten > 0 && training.minuten <= 1440)) {
          throw new Error('Ongeldige opgeslagen gegevens');
        }
        zetTrainingen(gegevens.trainingen);
        zetDoel(gegevens.doel);
        zetDoelInvoer(String(gegevens.doel));
      }
      zetGeladen(true);
    }).catch(() => {
      if (actief) zetOpslagStatus('Laden mislukt. Heropen de app om opnieuw te proberen. Je opgeslagen gegevens zijn niet overschreven.');
    });
    return () => { actief = false; };
  }, []);

  useEffect(() => {
    if (!geladen) return;
    let actueel = true;
    const tekst = JSON.stringify({ doel, trainingen });
    schrijfWachtrij.current = schrijfWachtrij.current.catch(() => {}).then(() => {
      if (actueel) zetOpslagStatus('Wijzigingen opslaan…');
      return AsyncStorage.setItem(OPSLAG_SLEUTEL, tekst);
    });
    schrijfWachtrij.current.then(() => {
      if (actueel) zetOpslagStatus('Opgeslagen op dit apparaat');
    }).catch(() => {
      if (actueel) zetOpslagStatus('Opslaan mislukt. Houd de app open en probeer een wijziging opnieuw.');
    });
    return () => { actueel = false; };
  }, [geladen, doel, trainingen]);
  const aantal = trainingen.length;
  const huidigeWeek = weekStart(new Date());
  const dezeWeek = trainingen.filter(training => inWeek(training, huidigeWeek)).length;
  const percentage = Math.min(100, Math.round(dezeWeek / doel * 100));
  const weken = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(huidigeWeek);
    start.setDate(start.getDate() - (7 - index) * 7);
    return { start, aantal: trainingen.filter(training => inWeek(training, start)).length };
  });
  const grafiekMax = Math.max(1, ...weken.map(week => week.aantal));
  const totaalMinuten = trainingen.reduce((som, training) => som + training.minuten, 0);
  const weekKilometers = trainingen.filter(training => inWeek(training, huidigeWeek)).reduce((som, training) => som + training.afstand, 0);

  function voegTrainingToe() {
    if (!geladen) { zetFout('Wacht tot je opgeslagen gegevens zijn geladen.'); return; }
    const trainingsDatum = leesDatum(datumInvoer);
    if (!trainingsDatum || trainingsDatum > new Date(new Date().setHours(23, 59, 59, 999))) {
      zetFout('Vul een bestaande datum in als dd-mm-jjjj, niet in de toekomst.'); return;
    }
    const afstandTekst = afstand.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(afstandTekst) || Number(afstandTekst) <= 0 || !Number.isFinite(Number(afstandTekst))) {
      zetFout('Vul een afstand groter dan 0 km in, bijvoorbeeld 7,5.');
      return;
    }
    if (!naam.trim() || !/^\d+$/.test(minuten) || Number(minuten) < 1 || Number(minuten) > 1440) {
      zetFout('Vul een sport in en een duur van 1 tot 1440 minuten.');
      return;
    }
    zetTrainingen(vorig => [{ id: Date.now().toString(), naam: naam.trim(), afstand: Number(afstandTekst), beschrijving: beschrijving.trim(), minuten: Number(minuten), datum: trainingsDatum.toLocaleDateString('nl-NL') }, ...vorig]);
    zetDatumInvoer(vandaag());
    zetNaam('Roeien'); zetAfstand(''); zetBeschrijving(''); zetMinuten(''); zetFout(''); zetFormulier(false);
  }

  function bewaarDoel() {
    if (!geladen) { zetFout('Wacht tot je opgeslagen gegevens zijn geladen.'); return; }
    if (!/^\d+$/.test(doelInvoer) || Number(doelInvoer) < 1 || Number(doelInvoer) > 1000) {
      zetFout('Kies een doel van 1 tot 1000 trainingen.'); return;
    }
    zetDoel(Number(doelInvoer)); zetDoelBewerken(false); zetFout('');
  }

  return (
    <KeyboardAvoidingView style={styles.scherm} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.inhoud} keyboardShouldPersistTaps="handled">
        <View style={styles.kop}><Text style={styles.logo}>D.</Text><View style={styles.merk}><Text style={styles.label}>DOELTRACKER</Text><Text style={styles.merkSubtitel}>ROWING JOURNAL</Text></View><Text style={styles.badge}>ROEIEN</Text></View>
        <View style={styles.hero}>
          <Image source={require('./assets/roeien-header.png')} style={styles.heroFoto} resizeMode="cover" accessible={false} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroInhoud}>
            <Text style={styles.heroLabel}>OP HET WATER. IN JE ELEMENT.</Text>
            <Text style={styles.titel}>Elke haal{ '\n' }brengt je verder.</Text>
            <Text style={styles.heroSubtitel}>Van je eerste kilometer tot je volgende doel.</Text>
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.opslagTekst}>{opslagStatus}</Text>
        <View style={styles.weekSamenvatting}><View><Text style={styles.heroLabel}>DEZE WEEK OP HET WATER</Text><Text style={styles.kilometers}>{weekKilometers.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}<Text style={styles.kmEenheid}> km</Text></Text></View><Text style={styles.weekAantal}>{dezeWeek} trainingen</Text></View>

        <View style={styles.doelKaart}>
          <Text style={styles.accentLabel}>MIJN WEEKDOEL · MAANDAG T/M ZONDAG</Text>
          <Text style={styles.doelTitel}>{doel} trainingen per week</Text>
          <Text style={styles.wit}>Week vanaf {huidigeWeek.toLocaleDateString('nl-NL')}</Text>
          <Text style={styles.groot}>{dezeWeek}<Text style={styles.noemer}> / {doel}</Text></Text>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: doel, now: Math.min(dezeWeek, doel) }} style={styles.balk}><View style={[styles.vulling, { width: `${percentage}%` }]} /></View>
          <Text style={styles.doelInfo}>{dezeWeek >= doel ? 'Weekdoel behaald! Tijd om trots te zijn.' : `Nog ${doel - dezeWeek} trainingen deze week. Jij kunt dit.`}</Text>
          <Knop tekst="Doel aanpassen" subtiel onPress={() => { zetDoelBewerken(!doelBewerken); zetDoelInvoer(String(doel)); zetFormulier(false); zetFout(''); }} />
          {doelBewerken && <View style={styles.formulier}><Text style={styles.wit}>Hoeveel trainingen wil je per week doen?</Text><TextInput accessibilityLabel="Aantal trainingen per week" style={styles.invoer} value={doelInvoer} onChangeText={zetDoelInvoer} keyboardType="number-pad" /><Knop tekst="Weekdoel bewaren" onPress={bewaarDoel} /></View>}
        </View>

        <View style={styles.statistieken}><View style={styles.stat}><Text style={styles.statGetal}>{aantal}</Text><Text style={styles.ondertitel}>totaal trainingen</Text></View><View style={styles.stat}><Text style={styles.statGetal}>{totaalMinuten}</Text><Text style={styles.ondertitel}>minuten actief</Text></View><View style={styles.stat}><Text style={styles.statGetal}>{percentage}%</Text><Text style={styles.ondertitel}>weekdoel</Text></View></View>
        <Knop tekst={formulier ? 'Annuleren' : '+  Training toevoegen'} onPress={() => { zetFormulier(!formulier); zetDoelBewerken(false); zetFout(''); }} />
        {formulier && <View style={styles.kaart}>
          <Text style={styles.sectieTitel}>Lekker bezig!</Text><Text style={styles.ondertitel}>Wat heb je vandaag gedaan?</Text>
          <Text style={styles.veldLabel}>Trainingsdatum (dd-mm-jjjj)</Text><TextInput accessibilityLabel="Trainingsdatum" style={styles.invoer} value={datumInvoer} onChangeText={zetDatumInvoer} placeholder="18-11-2026" maxLength={10} />
          <Text style={styles.veldLabel}>Sport of training</Text><TextInput accessibilityLabel="Sport of training" style={styles.invoer} placeholder="Bijvoorbeeld roeien" value={naam} onChangeText={zetNaam} maxLength={60} />
          <Text style={styles.veldLabel}>Afstand in km</Text>
          <TextInput accessibilityLabel="Afstand in kilometers" style={styles.invoer} placeholder="Bijvoorbeeld 7,5" value={afstand} onChangeText={zetAfstand} keyboardType="decimal-pad" maxLength={10} />
          <Text style={styles.veldLabel}>Wat heb je gedaan? (optioneel)</Text>
          <TextInput accessibilityLabel="Wat heb je gedaan?" style={[styles.invoer, { minHeight: 100, textAlignVertical: 'top' }]} placeholder="Bijvoorbeeld: rustig geroeid en daarna drie versnellingen." value={beschrijving} onChangeText={zetBeschrijving} multiline maxLength={500} />
          <Text style={styles.veldLabel}>Duur in minuten</Text><TextInput accessibilityLabel="Duur in minuten" style={styles.invoer} placeholder="Bijvoorbeeld 30" value={minuten} onChangeText={zetMinuten} keyboardType="number-pad" maxLength={4} />
          <Knop tekst="Training bewaren" onPress={voegTrainingToe} />
        </View>}
        {!!fout && <Text accessibilityRole="alert" style={styles.fout}>{fout}</Text>}
        <View style={styles.kaart}>
          <Text style={styles.sectieTitel}>Trainingen per week</Text>
          <Text style={styles.ondertitel}>De laatste 8 weken · datum onderaan is de maandag</Text>
          <View style={styles.grafiek}>
            {weken.map((week, index) => <View key={week.start.getTime()} style={styles.kolom} accessible accessibilityLabel={`Week vanaf ${week.start.toLocaleDateString('nl-NL')}: ${week.aantal} trainingen`}>
              <Text style={styles.trainingNaam}>{week.aantal}</Text>
              <View style={styles.staafRuimte}><View style={[styles.staaf, { height: week.aantal / grafiekMax * 120, backgroundColor: index === 7 ? '#123B70' : '#B9E2FF' }]} /></View>
              <Text style={styles.weekLabel}>{week.start.getDate()}/{week.start.getMonth() + 1}</Text>
            </View>)}
          </View>
          <Text style={styles.ondertitel}>Donkerblauw = deze week. Je weekdoel is {doel} trainingen.</Text>
        </View>
        <View style={styles.kaart}>
          <Text style={styles.sectieTitel}>Afstand per training</Text>
          <View style={styles.tabelRij}><Text style={[styles.tabelCel, styles.trainingNaam]}>Datum</Text><Text style={[styles.tabelCel, styles.trainingNaam]}>Afstand (km)</Text><Text style={[styles.tabelCel, styles.trainingNaam]}>Duur (min)</Text></View>
          {trainingen.map(training => <View key={training.id} style={styles.tabelRij}><Text style={styles.tabelCel}>{training.datum}</Text><Text style={styles.tabelCel}>{training.afstand == null ? '—' : training.afstand.toLocaleString('nl-NL', { maximumFractionDigits: 8 })}</Text><Text style={styles.tabelCel}>{training.minuten}</Text></View>)}
          {aantal === 0 && <Text style={styles.ondertitel}>Je afstanden verschijnen hier zodra je een training toevoegt.</Text>}
          <Text style={styles.trainingNaam}>Totaal: {trainingen.reduce((som, training) => som + (training.afstand || 0), 0).toLocaleString('nl-NL', { maximumFractionDigits: 8 })} km</Text>
        </View>
        <View style={styles.lijstKop}><Text style={styles.lijstTitel}>Jouw trainingen</Text><Text style={styles.opslagTekst}>{aantal} totaal</Text></View>
        {aantal === 0 && <View style={styles.kaart}><Text style={styles.sectieTitel}>Een frisse start</Text><Text style={styles.ondertitel}>Voeg je eerste training toe. Hier verschijnt straks jouw sportgeschiedenis.</Text></View>}
        {trainingen.map(training => <View key={training.id} style={styles.training}><View style={styles.sportIcoon}><Text style={styles.logo}>↗</Text></View><View style={styles.trainingInfo}><Text style={styles.trainingNaam}>{training.naam}</Text><Text style={styles.ondertitel}>{training.datum} · {training.minuten} min</Text>{!!training.beschrijving && <Text style={styles.ondertitel}>{training.beschrijving}</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={`Verwijder ${training.naam}`} onPress={() => zetTrainingen(vorig => vorig.filter(item => item.id !== training.id))} style={styles.verwijder}><Text style={styles.ondertitel}>Verwijder</Text></Pressable></View>)}
        <Knop tekst="Op mijn iPhone zetten" subtiel onPress={() => zetInstallatieHulp(!installatieHulp)} />
        {installatieHulp && <View style={styles.kaart}><Text style={styles.sectieTitel}>Altijd binnen handbereik</Text><Text style={styles.ondertitel}>Open de online link in Safari op je iPhone. Tik op Deel en kies ‘Zet op beginscherm’. Zet ‘Open als webapp’ aan als je die optie ziet, en tik op ‘Voeg toe’.</Text><Text style={styles.ondertitel}>Je trainingen worden op je telefoon bewaard. Gegevens van je laptop worden niet automatisch overgezet.</Text></View>}
        <Text style={styles.voet}>DOELTRACKER · JOUW PERSOONLIJKE ROEILOGBOEK{ '\n' }Bewaard op dit apparaat. Elke haal telt.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  merk: { flex: 1, gap: 4 },
  merkSubtitel: { fontSize: 12, letterSpacing: 2, color: '#A6B9CF' },
  opslagTekst: { color: '#AFBED0', fontSize: 13, lineHeight: 20 },
  lijstTitel: { color: '#F4F7FC', fontSize: 22, fontWeight: '600' },
  weekSamenvatting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, gap: 12, borderBottomWidth: 1, borderBottomColor: '#29405B' },
  kilometers: { color: '#FFFFFF', fontSize: 44, fontWeight: '600', marginTop: 12 },
  kmEenheid: { fontSize: 22, color: '#B1C7DD' },
  weekAantal: { color: '#D4B77B', fontSize: 14 },
  hero: { minHeight: 330, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B2447', justifyContent: 'flex-end' },
  heroFoto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 22, 48, 0.48)' },
  heroInhoud: { padding: 24, gap: 16 },
  heroLabel: { color: '#E4C996', fontSize: 12, letterSpacing: 1.4, fontWeight: '600' },
  heroSubtitel: { color: '#EDF6FF', fontSize: 14, lineHeight: 21 },
  grafiek: { flexDirection: 'row', gap: 5, marginTop: 8 },
  kolom: { flex: 1, alignItems: 'center', gap: 8 },
  staafRuimte: { height: 120, width: '100%', justifyContent: 'flex-end', backgroundColor: '#F0F6FD', borderRadius: 5, overflow: 'hidden' },
  staaf: { width: '100%', borderRadius: 5 },
  weekLabel: { fontSize: 12, color: '#576E88' },
  tabelRij: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DCE9F8', paddingVertical: 12, gap: 8 },
  tabelCel: { flex: 1, color: '#304F70', fontSize: 13 },
  scherm: { flex: 1, backgroundColor: '#08182B' },
  inhoud: { padding: 20, paddingTop: 56, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center', gap: 22 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontSize: 32, fontWeight: '800', color: '#D4B77B' },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: 2.5, color: '#F4F7FC' },
  badge: { fontSize: 12, letterSpacing: 1, color: '#D4B77B', borderWidth: 1, borderColor: '#61543D', padding: 9, borderRadius: 8 },
  titel: { fontSize: 36, fontWeight: '800', letterSpacing: -1.4, color: '#FFFFFF', marginTop: 18, lineHeight: 42 },
  ondertitel: { color: '#526980', fontSize: 14, lineHeight: 23 },
  doelKaart: { backgroundColor: '#122F50', borderWidth: 1, borderColor: '#2B4C70', borderRadius: 24, padding: 24, gap: 18, marginTop: 0 },
  accentLabel: { color: '#E4C996', fontSize: 12, letterSpacing: 1.5, fontWeight: '600' },
  doelTitel: { color: '#FFFFFF', fontSize: 21, fontWeight: '600' },
  groot: { color: '#FFFFFF', fontSize: 64, fontWeight: '700' },
  noemer: { color: '#B5D3F0', fontSize: 26 },
  balk: { height: 10, borderRadius: 5, backgroundColor: '#325C87', overflow: 'hidden' },
  vulling: { height: '100%', backgroundColor: '#B9E2FF', borderRadius: 5 },
  doelInfo: { color: '#E0EFFF', fontSize: 13, lineHeight: 20 },
  knop: { backgroundColor: '#DCC18D', paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', minHeight: 52 },
  knopTekst: { color: '#10243D', fontSize: 16, fontWeight: '700' },
  subtiel: { backgroundColor: '#27558A' }, subtielTekst: { color: '#E5F3FF' },
  statistieken: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#F4F7FC', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 4, alignItems: 'center', gap: 6 },
  statGetal: { fontSize: 25, fontWeight: '700', color: '#123B70' },
  kaart: { backgroundColor: '#F8FAFE', borderRadius: 22, padding: 20, gap: 16 },
  sectieTitel: { color: '#123B70', fontSize: 19, fontWeight: '700' },
  veldLabel: { color: '#304F70', fontSize: 14, fontWeight: '600', marginTop: 4 },
  invoer: { backgroundColor: '#F0F6FD', borderWidth: 1, borderColor: '#C7DDF3', borderRadius: 10, padding: 14, fontSize: 16, color: '#123B70', minHeight: 48 },
  formulier: { gap: 12 }, wit: { color: '#FFFFFF', fontSize: 14 },
  fout: { color: '#FFB7AE', fontSize: 14, lineHeight: 21 },
  lijstKop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  training: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, gap: 12 },
  sportIcoon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E2F0FF', alignItems: 'center', justifyContent: 'center' },
  trainingInfo: { flex: 1 }, trainingNaam: { color: '#123B70', fontWeight: '700', fontSize: 15 },
  verwijder: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  voet: { color: '#A7B8CC', fontSize: 12, textAlign: 'center', lineHeight: 22, marginTop: 12 },
});
