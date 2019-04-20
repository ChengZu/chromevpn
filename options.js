'use strict';

var proxy = chrome.extension.getBackgroundPage().proxy;

function constructOptions(proxyServer) {

	if (proxyServer == null) {
		proxy.getProxyServer(function(data) {
			if (data) constructOptions(data);
			else popBox('Network Error.', 3000);
		});
		return;
	}

	var selected = '';
	var selectEle = document.getElementById('proxyType');
	selectEle.innerHTML = '';
	for (var item of proxyServer.spdy.ports) {
		if (item.type == proxy.proxyType) selected = 'selected';
		selectEle.innerHTML += '<option value="' + item.type + '" ' + selected + '>' + item.type + '</option>';
		selected = '';
	}

	document.getElementById('connect').onclick = function(element) {
		setProxy();
	};

	document.getElementById('disconnect').onclick = function(element) {
		popBox('Success.', 1500);
		proxy.clearProxy();
	};

	document.getElementById('repair').onclick = function(element) {
		popBox('Success.', 1500);
		proxy.repair();
	};

	selectEle.onchange = function() {
		proxy.proxyType = selectEle[selectEle.selectedIndex].value;
		proxy.setStorage('proxyType', proxy.proxyType,
		function() {});
	}

}
function setProxy(elem) {
	if (proxy.state.get() == proxy.STATES.ON_SETTING) {
		return;
	}

	if (proxy.state.get() == proxy.STATES.ACTIVATE) {
		popBox('Disconnect<br >First.', 3000);
		return;
	}
	popBox('On Setting...');

	proxy.setProxy();

	proxy.state.onChange.addListener(function(oldState, newState) {
		closeBox();
		return true;
	});
}

function popBox(val, time) {
	var popBox = document.getElementById("popBox");
	var popLayer = document.getElementById("popLayer");
	var popContent = document.getElementById("popContent");
	popBox.style.display = "block";
	popLayer.style.display = "block";
	popContent.innerHTML = val;
	if (time) {
		setTimeout(closeBox, time);
	}
};

function closeBox() {
	var popBox = document.getElementById("popBox");
	var popLayer = document.getElementById("popLayer");
	popBox.style.display = "none";
	popLayer.style.display = "none";
}

window.onload = function() {
	proxy = chrome.extension.getBackgroundPage().proxy;
	proxy.getStorage('proxyType',
	function(result) {
		if (result) proxy.proxyType = result.proxyType;
		constructOptions(proxy.proxyServer);
	});
}