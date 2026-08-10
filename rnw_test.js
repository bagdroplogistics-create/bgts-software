// Alias 'react-native' -> 'react-native-web' so ui.js's RN imports resolve to real DOM components.
const Module = require('module');
const path = require('path');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'react-native') {
    request = 'react-native-web';
  }
  return origResolve.call(this, request, ...args);
};

require('@babel/register')({
  presets: ['babel-preset-expo'],
  extensions: ['.js', '.jsx'],
  ignore: [/node_modules\/(?!react-native-web)/],
});

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { Table } = require('/sessions/trusting-laughing-rubin/mnt/BGTS TRANSPORT/bgts-software/src/ui.js');

const cols = [
  { key: 'client', label: 'Client', width: 150 },
  { key: 'bookings', label: 'Bookings', width: 80 },
  { key: 'turnover', label: 'Turnover', width: 100 },
  { key: 'status', label: 'Status', width: 100 },
];
const rows = [
  { client: 'GUJARAT STATE ELECTRICITY CORPORATION LIMITED GANDHINAGAR', bookings: 0, turnover: '₹6,57,453', status: '60D+ OVERDUE' },
];

const el = React.createElement(Table, { cols, rows });
const html = ReactDOMServer.renderToStaticMarkup(el);
require('fs').writeFileSync('/tmp/rnw_table_output.html', html);
console.log(html);
