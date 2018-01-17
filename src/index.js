import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

import Web3 from 'web3';

var web3 = new Web3(window.web3.currentProvider);

ReactDOM.render(<App web3={web3}/>, document.getElementById('root'));
registerServiceWorker();
