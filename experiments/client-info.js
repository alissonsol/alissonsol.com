function updateProgress(elementId, percent) {
	const progressBar = document.getElementById(elementId);
	if (progressBar) progressBar.style.width = percent + '%';
}

function ipToNumber(ip) {
	const parts = ip.trim().split('.');
	if (parts.length !== 4) return null;
	return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

async function searchIPInRanges(ipAddress) {
	try {
		const response = await fetch('client-ranges.csv');
		const csvText = await response.text();
		const lines = csvText.trim().split('\n');

		if (lines.length === 0) return 'The IP address ranges file client-ranges.csv is mal-formed.';

		const header = lines[0].split(',').map(h => h.trim());
		if (header.length !== 3 || header[0] !== 'id' || header[1] !== 'range-start' || header[2] !== 'range-end') {
			return 'The IP address ranges file client-ranges.csv is mal-formed.';
		}

		const clientIPNum = ipToNumber(ipAddress);
		if (clientIPNum === null) return 'Invalid IP address format.';

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			const parts = line.split(',').map(p => p.trim());
			if (parts.length !== 3) continue;

			const [id, rangeStart, rangeEnd] = parts;
			const startNum = ipToNumber(rangeStart);
			const endNum = ipToNumber(rangeEnd);

			if (startNum === null || endNum === null) continue;

			if (clientIPNum >= startNum && clientIPNum <= endNum) {
				return `IP address found in range ${id}, ${rangeStart}, ${rangeEnd}`;
			}
		}

		return 'IP address not found in the ranges from the client-ranges.csv file.';
	} catch (error) {
		return `Error reading CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

async function measureRTT(url) {
	try {
		const startTime = performance.now();
		await fetch(url, { mode: 'no-cors' });
		return `${Math.round(performance.now() - startTime)} ms`;
	} catch (error) {
		return 'Error';
	}
}

async function isPrivateMode() {
	return new Promise((resolve) => {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			navigator.storage.estimate().then(({ quota }) => {
				resolve(quota < 120000000);
			}).catch(() => resolve(false));
		} else {
			const db = indexedDB.open('test');
			db.onerror = () => resolve(true);
			db.onsuccess = () => {
				resolve(false);
				indexedDB.deleteDatabase('test');
			};
		}
		setTimeout(() => resolve(false), 1000);
	});
}

function hideLoadingElements(sectionId) {
	setTimeout(() => {
		const loadingContainer = document.querySelector(`#${sectionId} .loading-container`);
		const progressContainer = document.querySelector(`#${sectionId} .progress-bar`);
		if (loadingContainer) loadingContainer.style.display = 'none';
		if (progressContainer) progressContainer.style.display = 'none';
	}, 500);
}

async function fetchIPInfo() {
	const ipInfoTable = document.getElementById('ip-info-table');
	const providerInfoTable = document.getElementById('provider-info-table');
	if (!ipInfoTable || !providerInfoTable) return;

	const privateMode = await isPrivateMode();
	if (privateMode) {
		ipInfoTable.innerHTML = `<tr><td colspan="2" class="private-mode">Private/Incognito mode detected. IP information is not available in this mode.</td></tr>`;
		providerInfoTable.innerHTML = `<tr><td colspan="2" class="private-mode">Private/Incognito mode detected. Provider information is not available in this mode.</td></tr>`;
		hideLoadingElements('ip-info');
		hideLoadingElements('provider-info');
		return;
	}

	try {
		updateProgress('ip-progress', 10);
		updateProgress('provider-progress', 10);

		const ipv4Response = await fetch('https://api.ipify.org?format=json');
		const ipv4Data = await ipv4Response.json();
		updateProgress('ip-progress', 40);
		updateProgress('provider-progress', 40);

		let ipv6Data = null;
		try {
			const ipv6Response = await fetch('https://api64.ipify.org?format=json');
			ipv6Data = await ipv6Response.json();
		} catch (e) {
			console.log('IPv6 not available');
		}
		updateProgress('ip-progress', 60);
		updateProgress('provider-progress', 60);

		const detailResponse = await fetch('https://ipinfo.io/json');
		const detailData = await detailResponse.json();
		updateProgress('ip-progress', 90);
		updateProgress('provider-progress', 90);

		const hasIPv6 = ipv6Data?.ip?.includes(':');
		const ipSearchResult = await searchIPInRanges(ipv4Data.ip);
		const usEast1RTT = await measureRTT('https://ws-broker-service.us-east-1.amazonaws.com/ping');
		const usWest2RTT = await measureRTT('https://ws-broker-service.us-west-2.amazonaws.com/ping');

		ipInfoTable.innerHTML = `
			<tr><td>IPv4 Address</td><td>${ipv4Data.ip || 'Not available'}</td></tr>
			<tr><td>IPv6 Address</td><td>${hasIPv6 ? ipv6Data.ip : 'Not available'}</td></tr>
			<tr><td>IP Search</td><td>${ipSearchResult}</td></tr>
			<tr><td>us-east-1</td><td>${usEast1RTT}</td></tr>
			<tr><td>us-west-2</td><td>${usWest2RTT}</td></tr>
		`;

		providerInfoTable.innerHTML = `
			<tr><td>ISP/Organization</td><td>${detailData.org || 'Not available'}</td></tr>
			<tr><td>City</td><td>${detailData.city || 'Not available'}</td></tr>
			<tr><td>Region</td><td>${detailData.region || 'Not available'}</td></tr>
			<tr><td>Country</td><td>${detailData.country || 'Not available'}</td></tr>
			<tr><td>Postal Code</td><td>${detailData.postal || 'Not available'}</td></tr>
			<tr><td>Timezone</td><td>${detailData.timezone || 'Not available'}</td></tr>
		`;

		updateProgress('ip-progress', 100);
		updateProgress('provider-progress', 100);

		if (detailData.loc) {
			const [lat, lon] = detailData.loc.split(',');
			displayIPBasedGeolocation(parseFloat(lat), parseFloat(lon), 'IP-based');
			const buttonContainer = document.getElementById('geo-button-container');
			if (buttonContainer) buttonContainer.style.display = 'none';
		}

		hideLoadingElements('ip-info');
		hideLoadingElements('provider-info');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		ipInfoTable.innerHTML = `<tr><td colspan="2" class="error">Error loading IP information: ${errorMsg}</td></tr>`;
		providerInfoTable.innerHTML = `<tr><td colspan="2" class="error">Error loading provider information: ${errorMsg}</td></tr>`;
		hideLoadingElements('ip-info');
		hideLoadingElements('provider-info');
	}
}

async function fetchGeolocation() {
	const geoInfoTable = document.getElementById('geo-info-table');
	const loadingContainer = document.querySelector('#geo-info .loading-container');
	const progressContainer = document.querySelector('#geo-info .progress-bar');
	const buttonContainer = document.getElementById('geo-button-container');

	if (!geoInfoTable) return;

	if (!navigator.geolocation) {
		geoInfoTable.innerHTML = `<tr><td colspan="2" class="error">Geolocation is not supported by your browser</td></tr>`;
		if (buttonContainer) buttonContainer.style.display = 'none';
		return;
	}

	if (buttonContainer) buttonContainer.style.display = 'none';
	if (loadingContainer) loadingContainer.style.display = 'flex';
	if (progressContainer) progressContainer.style.display = 'block';

	updateProgress('geo-progress', 20);
	geoInfoTable.innerHTML = `<tr><td colspan="2">Requesting location permission...</td></tr>`;

	navigator.geolocation.getCurrentPosition(
		(position) => {
			updateProgress('geo-progress', 60);
			const pos = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				accuracy: position.coords.accuracy,
				altitude: position.coords.altitude,
				altitudeAccuracy: position.coords.altitudeAccuracy,
				heading: position.coords.heading,
				speed: position.coords.speed
			};

			updateProgress('geo-progress', 80);
			displayGeolocation(pos);
			updateProgress('geo-progress', 100);
			hideLoadingElements('geo-info');
		},
		(error) => {
			const errorMessages = {
				[error.PERMISSION_DENIED]: 'User denied the request for Geolocation.',
				[error.POSITION_UNAVAILABLE]: 'Location information is unavailable.',
				[error.TIMEOUT]: 'The request to get user location timed out.'
			};
			const errorMsg = errorMessages[error.code] || 'An unknown error occurred.';
			geoInfoTable.innerHTML = `<tr><td colspan="2" class="error">Geolocation error: ${errorMsg}</td></tr>`;

			if (loadingContainer) loadingContainer.style.display = 'none';
			if (progressContainer) progressContainer.style.display = 'none';
			if (buttonContainer) buttonContainer.style.display = 'flex';
		}
	);
}

function displayIPBasedGeolocation(lat, lon, source) {
	const geoInfoTable = document.getElementById('geo-info-table');
	if (!geoInfoTable) return;

	const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
	geoInfoTable.innerHTML = `
		<tr><td>Source</td><td>${source}</td></tr>
		<tr><td>Latitude</td><td>${lat.toFixed(6)}</td></tr>
		<tr><td>Longitude</td><td>${lon.toFixed(6)}</td></tr>
		<tr><td>Accuracy</td><td>IP-based (approximate) - <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">View on Google Maps</a></td></tr>
	`;
}

function displayGeolocation(pos) {
	const geoInfoTable = document.getElementById('geo-info-table');
	if (!geoInfoTable) return;

	const mapsUrl = `https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`;
	let rows = `
		<tr><td>Source</td><td>Browser Geolocation API</td></tr>
		<tr><td>Latitude</td><td>${pos.latitude.toFixed(6)}</td></tr>
		<tr><td>Longitude</td><td>${pos.longitude.toFixed(6)}</td></tr>
		<tr><td>Accuracy</td><td>${pos.accuracy.toFixed(2)} meters - <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">View on Google Maps</a></td></tr>
	`;

	if (pos.altitude !== null) rows += `<tr><td>Altitude</td><td>${pos.altitude.toFixed(2)} meters</td></tr>`;
	if (pos.altitudeAccuracy !== null) rows += `<tr><td>Altitude Accuracy</td><td>${pos.altitudeAccuracy.toFixed(2)} meters</td></tr>`;
	if (pos.heading !== null) rows += `<tr><td>Heading</td><td>${pos.heading.toFixed(2)} degrees</td></tr>`;
	if (pos.speed !== null) rows += `<tr><td>Speed</td><td>${pos.speed.toFixed(2)} m/s</td></tr>`;

	geoInfoTable.innerHTML = rows;
}

/**
 * Attempts to detect if Palo Alto GlobalProtect is detected
 * by triggering its custom URI scheme.
 * @returns Promise<boolean> - True if the application responded to the protocol.
 */
async function isGlobalProtectDetected() {
	return new Promise((resolve) => {
		let hasResponded = false;

		// The blur event fires if the browser successfully hands off
		// the request to an external application (GlobalProtect).
		const handleBlur = () => {
			hasResponded = true;
			window.removeEventListener('blur', handleBlur);
		};

		window.addEventListener('blur', handleBlur);

		// Attempt to open the GlobalProtect custom protocol
		// Using a hidden iframe is less disruptive than window.location
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = 'globalprotect://';
		document.body.appendChild(iframe);

		// Wait for a short duration to see if the 'blur' event triggers.
		// 500ms is usually sufficient for the OS hand-off.
		setTimeout(() => {
			window.removeEventListener('blur', handleBlur);
			if (document.body.contains(iframe)) {
				document.body.removeChild(iframe);
			}
			resolve(hasResponded);
		}, 500);
	});
}

/**
 * Attempts to detect if Broadcom WSS Agent (Web Security Service Agent) is detected
 * by checking for browser extensions and custom protocol handlers.
 * @returns Promise<boolean> - True if WSS Agent is detected.
 */
async function isWSSDetected() {
	return new Promise((resolve) => {
		let hasResponded = false;

		// Check for common WSS Agent indicators
		// 1. Check for custom protocol handler (similar to GlobalProtect)
		const handleBlur = () => {
			hasResponded = true;
			window.removeEventListener('blur', handleBlur);
		};

		window.addEventListener('blur', handleBlur);

		// Try WSS custom protocol if it exists
		// Note: WSS Agent may use 'wss://', 'symantecwss://', or 'bcwss://' protocols
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = 'symantecwss://';
		document.body.appendChild(iframe);

		// Additionally check for WSS Agent extension artifacts in the DOM
		// WSS Agent often injects elements or modifies the page
		const checkWSSArtifacts = () => {
			// Check for common WSS Agent injected elements or attributes
			const hasWSSElement = document.querySelector('[data-wss-agent]') !== null ||
				document.querySelector('[class*="wss-"]') !== null ||
				document.querySelector('[id*="wss-"]') !== null ||
				document.querySelector('[class*="symantec"]') !== null;

			// Check if WSS Agent modified the window object
			const hasWSSProperty = 'WSSAgent' in window ||
				'SymantecWSS' in window ||
				'BroadcomWSS' in window;

			return hasWSSElement || hasWSSProperty;
		};

		// Wait for a short duration to see if the 'blur' event triggers
		// or if WSS artifacts are detected
		setTimeout(() => {
			window.removeEventListener('blur', handleBlur);
			if (document.body.contains(iframe)) {
				document.body.removeChild(iframe);
			}

			// Resolve true if either blur event fired or WSS artifacts detected
			resolve(hasResponded || checkWSSArtifacts());
		}, 500);
	});
}

/**
 * Attempts to detect if Netskope Agent (Netskope One Client) is detected
 * by checking for browser extensions, custom protocol handlers, and DOM modifications.
 * @returns Promise<boolean> - True if Netskope Agent is detected.
 */
async function isNetskopeDetected() {
	return new Promise((resolve) => {
		let hasResponded = false;

		// Check for Netskope custom protocol handler
		const handleBlur = () => {
			hasResponded = true;
			window.removeEventListener('blur', handleBlur);
		};

		window.addEventListener('blur', handleBlur);

		// Try Netskope custom protocol
		// Netskope may use 'netskope://', 'nsclient://', or similar protocols
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = 'netskope://';
		document.body.appendChild(iframe);

		// Check for Netskope Agent artifacts
		const checkNetskopeArtifacts = () => {
			// Check for Netskope injected elements or attributes
			const hasNetskopeElement = document.querySelector('[data-netskope]') !== null ||
				document.querySelector('[class*="netskope"]') !== null ||
				document.querySelector('[id*="netskope"]') !== null ||
				document.querySelector('[class*="ns-"]') !== null ||
				document.querySelector('[id*="ns-client"]') !== null;

			// Check if Netskope modified the window object
			const hasNetskopeProperty = 'Netskope' in window ||
				'NetskopeClient' in window ||
				'nsClient' in window ||
				'NSClient' in window;

			// Check for Netskope browser extension by looking for injected scripts
			const hasNetskopeScript = Array.from(document.scripts).some(script =>
				script.src.includes('netskope') || script.id.includes('netskope')
			);

			// Check for Netskope certificate or proxy indicators
			// Netskope often intercepts HTTPS traffic and may modify headers
			const hasNetskopeMeta = document.querySelector('meta[name*="netskope"]') !== null;

			return hasNetskopeElement || hasNetskopeProperty || hasNetskopeScript || hasNetskopeMeta;
		};

		// Wait for a short duration to see if the 'blur' event triggers
		// or if Netskope artifacts are detected
		setTimeout(() => {
			window.removeEventListener('blur', handleBlur);
			if (document.body.contains(iframe)) {
				document.body.removeChild(iframe);
			}

			// Resolve true if either blur event fired or Netskope artifacts detected
			resolve(hasResponded || checkNetskopeArtifacts());
		}, 500);
	});
}

async function displayBrowserInfo() {
	const browserInfoTable = document.getElementById('browser-info-table');
	if (!browserInfoTable) return;

	updateProgress('browser-progress', 15);

	const isGlobalProtect = await isGlobalProtectDetected();

	updateProgress('browser-progress', 40);

	const isWSS = await isWSSDetected();

	updateProgress('browser-progress', 65);

	const isNetskope = await isNetskopeDetected();

	updateProgress('browser-progress', 90);

	browserInfoTable.innerHTML = `
		<tr><td>User Agent</td><td>${navigator.userAgent}</td></tr>
		<tr><td>Platform</td><td>${navigator.platform}</td></tr>
		<tr><td>Language</td><td>${navigator.language}</td></tr>
		<tr><td>Screen Resolution</td><td>${screen.width} x ${screen.height}</td></tr>
		<tr><td>Color Depth</td><td>${screen.colorDepth}-bit</td></tr>
		<tr><td>Cookies Enabled</td><td>${navigator.cookieEnabled ? 'Yes' : 'No'}</td></tr>
		<tr><td>Online Status</td><td>${navigator.onLine ? 'Online' : 'Offline'}</td></tr>
		<tr><td>Is Global Protect Detected</td><td>${isGlobalProtect ? 'Yes' : 'No'}</td></tr>
		<tr><td>Is WSS Detected</td><td>${isWSS ? 'Yes' : 'No'}</td></tr>
		<tr><td>Is Netskope Detected</td><td>${isNetskope ? 'Yes' : 'No'}</td></tr>
	`;

	updateProgress('browser-progress', 100);
	hideLoadingElements('browser-info');
}

function init() {
	fetchIPInfo().catch(err => console.error('IP Info Error:', err));
	displayBrowserInfo();

	const geoButton = document.getElementById('allow-geolocation-btn');
	if (geoButton) {
		geoButton.addEventListener('click', () => {
			fetchGeolocation().catch(err => console.error('Geolocation Error:', err));
		});
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
