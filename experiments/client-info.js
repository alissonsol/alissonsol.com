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

async function isGlobalProtectDetected() {
	const hasGPElement = document.querySelector('[data-globalprotect]') !== null ||
		document.querySelector('[class*="globalprotect"]') !== null ||
		document.querySelector('[id*="globalprotect"]') !== null ||
		document.querySelector('[class*="pan-gp"]') !== null;

	const hasGPProperty = 'GlobalProtect' in window ||
		'PanGP' in window ||
		'PaloAltoNetworks' in window;

	const hasGPScript = Array.from(document.scripts).some(script =>
		script.src.toLowerCase().includes('globalprotect') ||
		script.src.toLowerCase().includes('pan-gp')
	);

	return hasGPElement || hasGPProperty || hasGPScript;
}

function tryGlobalProtectProtocol() {
	return new Promise((resolve) => {
		let detected = false;

		const handleBlur = () => {
			detected = true;
			window.removeEventListener('blur', handleBlur);
		};

		window.addEventListener('blur', handleBlur);

		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = 'globalprotectcallback://';
		document.body.appendChild(iframe);

		setTimeout(() => {
			window.removeEventListener('blur', handleBlur);
			if (document.body.contains(iframe)) {
				document.body.removeChild(iframe);
			}
			resolve(detected);
		}, 1500);
	});
}

async function onTryGlobalProtectClick() {
	const cell = document.getElementById('gp-detect-cell');
	if (!cell) return;

	cell.innerHTML = 'Testing... (dismiss any dialog that appears)';

	const detected = await tryGlobalProtectProtocol();

	if (detected) {
		cell.innerHTML = 'Yes (protocol handler)';
	} else {
		cell.innerHTML = 'No (may be false negative)';
	}
}

async function fetchWSSIPRanges() {
	try {
		const response = await fetch('https://servicepoints.threatpulse.com/api/v2/full');
		const data = await response.json();
		const ipRanges = [];
		if (data.servicePoints && Array.isArray(data.servicePoints)) {
			for (const sp of data.servicePoints) {
				if (sp.ipv4Cidrs && Array.isArray(sp.ipv4Cidrs)) {
					for (const cidr of sp.ipv4Cidrs) {
						ipRanges.push(cidr);
					}
				}
			}
		}
		return ipRanges;
	} catch (e) {
		return [];
	}
}

function cidrToRange(cidr) {
	const [ip, prefixStr] = cidr.split('/');
	const prefix = parseInt(prefixStr, 10);
	const ipNum = ipToNumber(ip);
	if (ipNum === null) return null;
	const mask = ~((1 << (32 - prefix)) - 1) >>> 0;
	const start = (ipNum & mask) >>> 0;
	const end = (start | ~mask) >>> 0;
	return { start, end };
}

function isIPInCIDRList(ip, cidrList) {
	const ipNum = ipToNumber(ip);
	if (ipNum === null) return false;
	for (const cidr of cidrList) {
		const range = cidrToRange(cidr);
		if (range && ipNum >= range.start && ipNum <= range.end) {
			return true;
		}
	}
	return false;
}

async function getWebRTCPublicIP() {
	return new Promise((resolve) => {
		try {
			const pc = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
			});
			const ips = new Set();
			let resolved = false;

			pc.onicecandidate = (event) => {
				if (resolved) return;
				if (event.candidate && event.candidate.candidate) {
					const matches = event.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g);
					if (matches) {
						for (const ip of matches) {
							if (!ip.startsWith('10.') && !ip.startsWith('192.168.') &&
								!ip.startsWith('172.16.') && !ip.startsWith('172.17.') &&
								!ip.startsWith('172.18.') && !ip.startsWith('172.19.') &&
								!ip.startsWith('172.20.') && !ip.startsWith('172.21.') &&
								!ip.startsWith('172.22.') && !ip.startsWith('172.23.') &&
								!ip.startsWith('172.24.') && !ip.startsWith('172.25.') &&
								!ip.startsWith('172.26.') && !ip.startsWith('172.27.') &&
								!ip.startsWith('172.28.') && !ip.startsWith('172.29.') &&
								!ip.startsWith('172.30.') && !ip.startsWith('172.31.') &&
								!ip.startsWith('127.') && !ip.startsWith('0.')) {
								ips.add(ip);
							}
						}
					}
				}
				if (!event.candidate) {
					resolved = true;
					pc.close();
					resolve(Array.from(ips));
				}
			};

			pc.createDataChannel('');
			pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {
				resolved = true;
				resolve([]);
			});

			setTimeout(() => {
				if (!resolved) {
					resolved = true;
					pc.close();
					resolve(Array.from(ips));
				}
			}, 3000);
		} catch (e) {
			resolve([]);
		}
	});
}

function detectProxyViaResourceTiming() {
	try {
		const entries = performance.getEntriesByType('resource');
		let h2Count = 0;
		let http11Count = 0;
		let protocolDowngradeDetected = false;

		for (const entry of entries) {
			if (entry.nextHopProtocol === 'h2') h2Count++;
			if (entry.nextHopProtocol === 'http/1.1') http11Count++;
			if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
				if (entry.nextHopProtocol === 'http/1.1' && entry.name.startsWith('https://')) {
					protocolDowngradeDetected = true;
				}
			}
		}

		if (protocolDowngradeDetected && http11Count > h2Count) {
			return true;
		}

		const connectTimes = [];
		const responseTimes = [];
		for (const entry of entries) {
			if (entry.connectEnd > entry.connectStart) {
				connectTimes.push(entry.connectEnd - entry.connectStart);
			}
			if (entry.responseStart > entry.requestStart && entry.responseStart > 0) {
				responseTimes.push(entry.responseStart - entry.requestStart);
			}
		}

		if (connectTimes.length > 5 && responseTimes.length > 5) {
			const avgConnect = connectTimes.reduce((a, b) => a + b, 0) / connectTimes.length;
			const avgResponse = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
			if (avgResponse > avgConnect * 2 && avgResponse > 200) {
				return true;
			}
		}
	} catch (e) {
	}
	return false;
}

async function isWSSDetected() {
	const hasWSSElement = document.querySelector('[data-wss-agent]') !== null ||
		document.querySelector('[class*="wss-"]') !== null ||
		document.querySelector('[id*="wss-"]') !== null ||
		document.querySelector('[class*="symantec"]') !== null ||
		document.querySelector('[class*="broadcom"]') !== null ||
		document.querySelector('[class*="bluecoat"]') !== null ||
		document.querySelector('[class*="threatpulse"]') !== null;

	const hasWSSProperty = 'WSSAgent' in window ||
		'SymantecWSS' in window ||
		'BroadcomWSS' in window ||
		'CloudSOC' in window ||
		'BlueCoat' in window ||
		'ThreatPulse' in window ||
		'WebPulse' in window;

	const hasWSSScript = Array.from(document.scripts).some(script => {
		const src = script.src.toLowerCase();
		return src.includes('symantec') ||
			src.includes('broadcom') ||
			src.includes('wss-agent') ||
			src.includes('bluecoat') ||
			src.includes('threatpulse');
	});

	if (hasWSSElement || hasWSSProperty || hasWSSScript) {
		return 'Yes (DOM/script)';
	}

	const wssOrgPatterns = [
		'symantec', 'broadcom', 'cloud soc', 'cloudsoc',
		'bluecoat', 'blue coat', 'threatpulse', 'webpulse',
		'as27471'
	];

	let publicIP = null;
	let orgInfo = null;

	try {
		const response = await fetch('https://ipinfo.io/json');
		const data = await response.json();
		publicIP = data.ip;
		orgInfo = data.org;
		if (orgInfo) {
			const orgLower = orgInfo.toLowerCase();
			for (const pattern of wssOrgPatterns) {
				if (orgLower.includes(pattern)) {
					return 'Yes (ISP org)';
				}
			}
		}
	} catch (e) {
	}

	if (publicIP) {
		try {
			const wssRanges = await fetchWSSIPRanges();
			if (wssRanges.length > 0 && isIPInCIDRList(publicIP, wssRanges)) {
				return 'Yes (WSS IP range)';
			}
		} catch (e) {
		}
	}

	try {
		const webrtcIPs = await getWebRTCPublicIP();
		if (publicIP && webrtcIPs.length > 0) {
			const hasMatchingIP = webrtcIPs.some(ip => ip === publicIP);
			if (!hasMatchingIP && webrtcIPs.length > 0) {
				const wssRanges = await fetchWSSIPRanges();
				if (wssRanges.length > 0 && isIPInCIDRList(publicIP, wssRanges)) {
					return 'Yes (WebRTC mismatch + WSS range)';
				}
			}
		}
	} catch (e) {
	}

	if (detectProxyViaResourceTiming()) {
		try {
			const wssRanges = await fetchWSSIPRanges();
			if (publicIP && wssRanges.length > 0 && isIPInCIDRList(publicIP, wssRanges)) {
				return 'Yes (timing + WSS range)';
			}
		} catch (e) {
		}
	}

	return false;
}

async function isNetskopeDetected() {
	const hasNetskopeElement = document.querySelector('[data-netskope]') !== null ||
		document.querySelector('[class*="netskope"]') !== null ||
		document.querySelector('[id*="netskope"]') !== null ||
		document.querySelector('[class*="ns-client"]') !== null ||
		document.querySelector('[id*="ns-client"]') !== null;

	const hasNetskopeProperty = 'Netskope' in window ||
		'NetskopeClient' in window ||
		'nsClient' in window ||
		'NSClient' in window ||
		'npa_client' in window;

	const hasNetskopeScript = Array.from(document.scripts).some(script =>
		script.src.toLowerCase().includes('netskope') ||
		script.id.toLowerCase().includes('netskope')
	);

	const hasNetskopeMeta = document.querySelector('meta[name*="netskope"]') !== null;

	if (hasNetskopeElement || hasNetskopeProperty || hasNetskopeScript || hasNetskopeMeta) {
		return 'Yes';
	}

	try {
		const response = await fetch('https://ipinfo.io/json');
		const data = await response.json();
		if (data.org && data.org.toLowerCase().endsWith('netskope inc')) {
			return 'Yes (detected ISP)';
		}
	} catch (e) {
	}

	return false;
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

	const falseNegativeNote = 'No (may be false negative)';
	browserInfoTable.innerHTML = `
		<tr><td>User Agent</td><td>${navigator.userAgent}</td></tr>
		<tr><td>Platform</td><td>${navigator.platform}</td></tr>
		<tr><td>Language</td><td>${navigator.language}</td></tr>
		<tr><td>Screen Resolution</td><td>${screen.width} x ${screen.height}</td></tr>
		<tr><td>Color Depth</td><td>${screen.colorDepth}-bit</td></tr>
		<tr><td>Cookies Enabled</td><td>${navigator.cookieEnabled ? 'Yes' : 'No'}</td></tr>
		<tr><td>Online Status</td><td>${navigator.onLine ? 'Online' : 'Offline'}</td></tr>
		<tr><td>Global Protect Detected</td><td id="gp-detect-cell">${isGlobalProtect ? 'Yes' : `${falseNegativeNote} <button onclick="onTryGlobalProtectClick()" style="margin-left: 8px; cursor: pointer;">Try Protocol</button>`}</td></tr>
		<tr><td>WSS Detected</td><td>${isWSS || falseNegativeNote}</td></tr>
		<tr><td>Netskope Detected</td><td>${isNetskope || falseNegativeNote}</td></tr>
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
