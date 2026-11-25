const app = require('./app.json').expo;

const repository = process.env.GITHUB_REPOSITORY;
const repositoryName = repository?.split('/')[1];
const isUserSite = repositoryName?.endsWith('.github.io');

module.exports = {
  ...app,
  experiments: {
    ...app.experiments,
    baseUrl: repositoryName && !isUserSite ? `/${repositoryName}` : '',
  },
};
