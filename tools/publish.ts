/* eslint-disable no-console */

import ArticlePublisher from '../services/ArticlePublisher';

const [target, mode] = process.argv.slice(2);
console.log('\x1b[36m%s\x1b[0m', 'Run...');
ArticlePublisher.publishArticles();
console.log('\x1b[36m%s\x1b[0m', 'Done!');
