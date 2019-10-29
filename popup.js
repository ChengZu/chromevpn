var proxy = chrome.extension.getBackgroundPage().proxy;
function constructPage() {
	var options = document.getElementsByClassName('settings');
	for (var item of options) {
		item.onclick = function(e) {
			proxy.openPage("options.html");
			window.close();
		};
	}
	if (proxy.state.get() == proxy.STATES.ACTIVATE) {
		hiddenPage(false, true, true, true);
		document.getElementById('disconnect').onclick = function(e) {
			proxy.clearProxy();
			window.close();
		};
		document.getElementById('repair').onclick = function(e) {
			proxy.repair();
			window.close();
		};
	} else {
		hiddenPage(true, false, true, true);
		proxy.state.onChange.addListener(activationListener);
		proxy.setProxy();
	}
}

function activationListener(oldState, newState) {
	if(newState == proxy.STATES.ON_SETTING) return false;
	if (proxy.state.get() == proxy.STATES.ACTIVATE) {
		hiddenPage(true, true, false, true);
	} else if (proxy.state.get() == proxy.STATES.CAN_RUN || proxy.state.get() == proxy.STATES.SERVER_ERROR || proxy.state.get() == proxy.STATES.ON_ERROR) {
		hiddenPage(true, true, true, false);
		proxy.repair();
	} else {
		hiddenPage(true, true, true, false);
		proxy.repair();
		window.close();
	}
	return true; //ture will removeListener self
}
function hiddenPage(disconnectPage, activationHalfPage, activationDonePage, activationErrorPage) {
	if (disconnectPage) document.getElementById('disconnect-container').style.display = "none";
	else document.getElementById('disconnect-container').style.display = "block";

	if (activationHalfPage) document.getElementById('activation-half').style.display = "none";
	else document.getElementById('activation-half').style.display = "block";

	if (activationDonePage) document.getElementById('activation-done').style.display = "none";
	else document.getElementById('activation-done').style.display = "block";

	if (activationErrorPage) document.getElementById('activation-error').style.display = "none";
	else document.getElementById('activation-error').style.display = "block";
	
	document.getElementById('white').style.display = "block";
}

window.onload = function() {
	constructPage();
}
