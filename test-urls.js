import { getDatasetViewUrl, getOrganizationViewUrl } from './src/utils/url-generator.js';

const serverUrl = 'https://www.dati.gov.it/opendata';
const pkg = {
  id: 'f20b37d0cd56764f77e4c707cc62b528eeb48ff24cdb415174a0dd31b63cad0c',
  name: 'test-dataset'
};

const org = {
  id: 'org-id',
  name: 'comune-di-bari'
};

console.log('Dataset URL:', getDatasetViewUrl(serverUrl, pkg));
console.log('Organization URL:', getOrganizationViewUrl(serverUrl, org));

const otherServer = 'https://demo.ckan.org';
console.log('Other Dataset URL:', getDatasetViewUrl(otherServer, pkg));
