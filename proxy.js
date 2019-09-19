'use strict';

var PROXY = function() {
	this.OPTS = {
		API_HOSTS: 'https://api.gomcomm.com',
		API_SUFFIX: "/api/v7/proxies/",
		AJAX_TIMEOUT_MS: 15000,
		FAST_AJAX_TIMEOUT_MS: 5000,
		SECS_FOR_PROXY_TO_EXPIRE: 86400,
		PROXY_TYPE: 'spdy',
		SECS_PER_SPEED_BOOSTER_NAG: 1200,
		SECS_TILL_FIRST_SPEED_BOOSTER_NAG: 30,
		DEVICE_PLATFORM: 'chrome',
		DEFAULT_COUNTRY_CODE: 'us',
	};
	this.STATES = {
		ACTIVATE: 0,
		CAN_RUN: 1,
		CAN_NOT_RUN: 2,
		CTR_BY_OTHER: 3,
		ON_SETTING: 4,
		ON_ERROR: 5,
		SERVER_CONNECT: 6,
		SERVER_ERROR: 7,
	};

	this.deviceId = this.genUuid();
	this.state.set(this.STATES.CAN_NOT_RUN);
	this.proxyServer = null;
	this.proxyType = 'https';
}
PROXY.prototype = {

	init: function() {
		var _that = this;
		_that.repair();
		_that.updateProxyState(true);
		
		_that.getStorage('proxyType',
		function(result) {
			if (result) _that.proxyType = result.proxyType;
		});

		chrome.proxy.settings.onChange.addListener(function(e) {
			_that.log('proxy settings onChange.' + e.levelOfControl);
			if (_that.state.get() == _that.STATES.ON_SETTING) {
				return;
			}
			_that.updateProxyState(true);
			
			
		});

		chrome.proxy.onProxyError.addListener(function(e) {
			_that.repair();
			_that.updateProxyState(true);
			_that.log('proxy onProxyError.');
		});

	},

	pingEndpoint: function(callback) {
		var _that = this;
		$.ajax({
			timeout: _that.OPTS.FAST_AJAX_TIMEOUT_MS,
			type: "GET",
			url: "https://api.gomcomm.com/gom4/test/?" + _that.deviceId,
			dataType: "json",
			crossDomain: true,
			success: function(data) {
				callback(true);
			},
			error: function(xhr) {
				callback(false);
			}
		});
	},

	getProxyServer: function(callback) {
		/*server return json format
		*{"spdy":{"host":"b-2.gomcomm.com","type":"spdy","id":"c79438dc-261c-11e6-908c-6c4008b73ff0","ports":[{"type":"default","number":"443"},{"type":"spdy","number":"40001"},{"type":"http","number":"55555"}]},"free_tier_recharge_mins":0.5,"free_tier_mins":15}
		*/
		//return callback({"spdy":{"host":"b-2.gomcomm.com","type":"spdy","id":"c79438dc-261c-11e6-908c-6c4008b73ff0","ports":[{"type":"default","number":"443"},{"type":"spdy","number":"40001"},{"type":"http","number":"55555"}]},"free_tier_recharge_mins":0.5,"free_tier_mins":15});

		var _that = this;
		_that.deviceId = _that.genUuid();
		$.ajax({
			timeout: _that.OPTS.FAST_AJAX_TIMEOUT_MS,
			type: "GET",
			url: _that.OPTS.API_HOSTS + _that.OPTS.API_SUFFIX,
			data: {
				service_token: '',
				device_id: _that.deviceId,
				type: _that.OPTS.PROXY_TYPE
			},
			dataType: "json",
			crossDomain: true,
			success: function(data) {
				callback(data);
			},
			error: function(xhr) {
				callback(false);
			}
		});
	},

	setProxy: function() {
		var _that = this;
		if (_that.state.get() == _that.STATES.ACTIVATE) {
			this.log('Activating, Please Disconnect!');
			return;
		}
		if (_that.state.get() == _that.STATES.ON_SETTING) {
			this.log('On Setting, Please Wait!');
			return;
		}

		_that.state.set(_that.STATES.ON_SETTING);
		//run on getProxyServer success
		_that.getProxyServer(function(data) {
			if (!data) return _that.updateStateAndUI(_that.STATES.SERVER_ERROR);

			_that.proxyServer = data;
			var port = '443';
			for (var item of data.spdy.ports) {
				if (item.type == _that.proxyType) port = item.number;
			}
			var pac = _that.genPacScript(data.spdy.host, port, ["*"], _that.proxyType);

			var config = {
				mode: "pac_script",
				pacScript: {
					data: pac
				}
			}

			chrome.proxy.settings.set({
				value: config,
				scope: 'regular'
			},
			function() {
				_that.pingEndpoint(function(success) {
					if (success) {
						_that.updateStateAndUI(_that.STATES.ACTIVATE);
					} else {
						_that.updateStateAndUI(_that.STATES.ON_ERROR);
					}
				});

			});
		});
	},

	repair: function() {
		this.clearProxy();
	},

	clearProxy: function() {
		var _that = this;
		var settings = {
			scope: "regular"
		};
		chrome.proxy.settings.clear(settings,
		function(e) {
			_that.updateProxyState(true);
		});
	},

	genPacScript: function(host, port, autoBypassRegexLis, type) {
		var autoBypassUrl, bypassStr, script, _i, _len;
		if (autoBypassRegexLis == null) {
			autoBypassRegexLis = [];
		}
		if (type == null || type == 'default') {
			type = "https";
		}
		bypassStr = "";
		for (_i = 0, _len = autoBypassRegexLis.length; _i < _len; _i++) {
			autoBypassUrl = autoBypassRegexLis[_i];
			bypassStr += "if (shExpMatch(url, \"" + autoBypassUrl + "\")) return \"" + type + " " + host + ":" + port + "\";";
		}
		script = "function FindProxyForURL(url, host) {\n\n    if (isPlainHostName(host) ||\n        shExpMatch(host, \"*.local\") ||\n        isInNet(dnsResolve(host), \"10.0.0.0\", \"255.0.0.0\") ||\n        isInNet(dnsResolve(host), \"172.16.0.0\", \"255.240.0.0\") ||\n        isInNet(dnsResolve(host), \"192.168.0.0\", \"255.255.0.0\") ||\n        isInNet(dnsResolve(host), \"127.0.0.0\", \"255.255.255.0\"))\n        return \"DIRECT\";\n\n    " + bypassStr + "\n\n    return \"DIRECT\";\n}";
		//proxy.log(script);
		return script;
	},

	genUuid: function() {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,
		function(c) {
			var r, v;
			r = Math.random() * 16 | 0;
			v = (c === "x" ? r: r & 0x3 | 0x8);
			return v.toString(16);
		});
	},

	updateProxyState: function(updateUI) {
		var _that = this;
		chrome.proxy.settings.get({},

		function(data) {
			//Enum "not_controllable", "controlled_by_other_extensions", "controllable_by_this_extension", or "controlled_by_that_extension"
			if (data.levelOfControl == 'not_controllable') {
				_that.state.set(_that.STATES.CAN_NOT_RUN);
			} else if (data.levelOfControl == 'controlled_by_other_extensions') {
				_that.state.set(_that.STATES.CTR_BY_OTHER);
			} else if (data.levelOfControl == 'controllable_by_this_extension') {
				_that.state.set(_that.STATES.CAN_RUN);
			} else if (data.levelOfControl == 'controlled_by_that_extension') {
				_that.state.set(_that.STATES.ACTIVATE);
			}else{
			}
			if(updateUI != undefined) _that.updateStateAndUI(_that.state.get());
		});
		
	},

	updateStateAndUI: function(value) {
		if (value == this.STATES.ACTIVATE) {
			this.activateBrowserIcon(true);
		} else if (value == this.STATES.ON_SETTING || value == this.STATES.CAN_RUN || value == this.STATES.CAN_NOT_RUN || value == this.STATES.CTR_BY_OTHER) {
			this.activateBrowserIcon(false);
		} else {
			this.activateBrowserIcon(false);
			this.repair();
		}
		this.state.set(value);
	},

	state: {
		value: '',

		set: function(val) {
			var old = this.value;
			this.value = val;
			if (old != val) this.onChange.dispatchevent(old, val);
		},
		get: function() {
			return this.value;
		},
		onChange: {
			listener: new Array(),
			addListener: function(callback) {
				if (this.listener.indexOf(callback) == -1) this.listener.push(callback);
			},
			removeListener: function(item) {
				for (var i = 0; i < this.listener.length; i++) {
					if (this.listener[i] == item) {
						this.listener.splice(i, 1);
						i--;
					}
				}
			},
			dispatchevent: function(oldState, newState) {
				for (var item of this.listener) {
					if (item(oldState, newState)) {
						this.removeListener(item);
					}
				}
			},
		},
	},

	setPopup: function(popupPage) {
		chrome.browserAction.setPopup({
			popup: popupPage
		});
	},

	openPage: function(page, focusOnTab) {
		if (focusOnTab == null) {
			focusOnTab = true;
		}
		return chrome.tabs.create({
			url: page,
			active: focusOnTab
		});
	},

	activateBrowserIcon: function(doActivate) {
		if (doActivate) {
			chrome.browserAction.setIcon({
				path: "images/icon-19-clicked.png"
			});
			chrome.browserAction.setBadgeText({
				text: "UP"
			});
			chrome.browserAction.setTitle({
				title: "Disconnect Free VPN"
			});
		} else {
			chrome.browserAction.setIcon({
				path: "images/icon-19.png"
			});
			chrome.browserAction.setBadgeText({
				text: ""
			});
			chrome.browserAction.setTitle({
				title: "Toggle Free VPN"
			});
		}
	},

	log: function(out) {
		if (out) console.log(out);
	},

	setStorage: function(key, value, callback) {
		chrome.storage.local.set(JSON.parse('{"' + key + '":"' + value + '"}'), callback);
	},

	getStorage: function(key, callback) {
		chrome.storage.local.get(key,
		function(items) {
			callback(items);
		});
	}
}

var proxy = new PROXY();

chrome.runtime.onInstalled.addListener(function() {
	proxy.log('Free VPN Init.');
	proxy.init();
});
