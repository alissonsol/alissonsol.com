// TypeScript-style code (will be interpreted as JavaScript)
// Interface definitions (as comments for TypeScript-style documentation)
// interface IPInfo { ip, city, region, country, loc, org, postal, timezone }
// interface GeoPosition { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed }

// Update progress bar
function updateProgress(elementId, percent) {
	const progressBar = document.getElementById(elementId);
	if (progressBar) {
		progressBar.style.width = percent + '%';
	}
}

// Convert IP address string to number for comparison
function ipToNumber(ip) {
	const parts = ip.trim().split('.');
	if (parts.length !== 4) return null;
	return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

// Search for IP in CSV ranges
async function searchIPInRanges(ipAddress) {
	try {
		const response = await fetch('client-ranges.csv');
		const csvText = await response.text();
		const lines = csvText.trim().split('\n');

		// Check if file has at least a header line
		if (lines.length === 0) {
			return 'The IP address ranges file client-ranges.csv is mal-formed.';
		}

		// Validate header
		const header = lines[0].split(',').map(h => h.trim());
		if (header.length !== 3 || header[0] !== 'id' || header[1] !== 'range-start' || header[2] !== 'range-end') {
			return 'The IP address ranges file client-ranges.csv is mal-formed.';
		}

		// Convert client IP to number
		const clientIPNum = ipToNumber(ipAddress);
		if (clientIPNum === null) {
			return 'Invalid IP address format.';
		}

		// Search through ranges
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue; // Skip empty lines

			const parts = line.split(',').map(p => p.trim());
			if (parts.length !== 3) continue; // Skip malformed lines

			const [id, rangeStart, rangeEnd] = parts;
			const startNum = ipToNumber(rangeStart);
			const endNum = ipToNumber(rangeEnd);

			if (startNum === null || endNum === null) continue; // Skip invalid IP ranges

			// Check if client IP is in range
			if (clientIPNum >= startNum && clientIPNum <= endNum) {
				return `IP address found in range ${id}, ${rangeStart}, ${rangeEnd}`;
			}
		}

		// IP not found in any range
		return 'IP address not found in the ranges from the client-ranges.csv file.';
	} catch (error) {
		return `Error reading CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

// Measure round trip time to a URL
async function measureRTT(url) {
	try {
		const startTime = performance.now();
		await fetch(url, { mode: 'no-cors' });
		const endTime = performance.now();
		const rtt = Math.round(endTime - startTime);
		return `${rtt} ms`;
	} catch (error) {
		return 'Error';
	}
}

// Fetch IP information from ipify and ipinfo.io
async function fetchIPInfo() {
	const ipInfoTable = document.getElementById('ip-info-table');
	const providerInfoTable = document.getElementById('provider-info-table');
	if (!ipInfoTable || !providerInfoTable) return;

	try {
		updateProgress('ip-progress', 10);
		updateProgress('provider-progress', 10);

		// Get IPv4 address
		const ipv4Response = await fetch('https://api.ipify.org?format=json');
		const ipv4Data = await ipv4Response.json();
		updateProgress('ip-progress', 40);
		updateProgress('provider-progress', 40);

		// Get IPv6 address (if available)
		let ipv6Data = null;
		try {
			const ipv6Response = await fetch('https://api64.ipify.org?format=json');
			ipv6Data = await ipv6Response.json();
		} catch (e) {
			console.log('IPv6 not available');
		}
		updateProgress('ip-progress', 60);
		updateProgress('provider-progress', 60);

		// Get detailed IP information from ipinfo.io
		const detailResponse = await fetch('https://ipinfo.io/json');
		const detailData = await detailResponse.json();
		updateProgress('ip-progress', 90);
		updateProgress('provider-progress', 90);

		// Determine if we have IPv6
		const hasIPv6 = ipv6Data && ipv6Data.ip && ipv6Data.ip.includes(':');

		// Search for IP in ranges
		const ipSearchResult = await searchIPInRanges(ipv4Data.ip);

		// Measure RTT to AWS endpoints
		const usEast1RTT = await measureRTT('https://ws-broker-service.us-east-1.amazonaws.com/ping');
		const usWest2RTT = await measureRTT('https://ws-broker-service.us-west-2.amazonaws.com/ping');

		// Populate IP Address table (only IP addresses)
		ipInfoTable.innerHTML = `
			<tr><td>IPv4 Address</td><td>${ipv4Data.ip || 'Not available'}</td></tr>
			<tr><td>IPv6 Address</td><td>${hasIPv6 ? ipv6Data.ip : 'Not available'}</td></tr>
			<tr><td>IP Search</td><td>${ipSearchResult}</td></tr>
			<tr><td>us-east-1</td><td>${usEast1RTT}</td></tr>
			<tr><td>us-west-2</td><td>${usWest2RTT}</td></tr>
		`;

		// Populate Access Provider table (ISP and location details)
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

		// If we have location data, show it in geolocation section
		if (detailData.loc) {
			const [lat, lon] = detailData.loc.split(',');
			displayIPBasedGeolocation(parseFloat(lat), parseFloat(lon), 'IP-based');
		}

		// Hide loading containers and progress bars after completion
		setTimeout(() => {
			const ipLoadingContainer = document.querySelector('#ip-info .loading-container');
			const ipProgressContainer = document.querySelector('#ip-info .progress-bar');
			const providerLoadingContainer = document.querySelector('#provider-info .loading-container');
			const providerProgressContainer = document.querySelector('#provider-info .progress-bar');

			if (ipLoadingContainer) ipLoadingContainer.style.display = 'none';
			if (ipProgressContainer) ipProgressContainer.style.display = 'none';
			if (providerLoadingContainer) providerLoadingContainer.style.display = 'none';
			if (providerProgressContainer) providerProgressContainer.style.display = 'none';
		}, 500);
	} catch (error) {
		ipInfoTable.innerHTML = `<tr><td colspan="2" class="error">Error loading IP information: ${error instanceof Error ? error.message : 'Unknown error'}</td></tr>`;
		providerInfoTable.innerHTML = `<tr><td colspan="2" class="error">Error loading provider information: ${error instanceof Error ? error.message : 'Unknown error'}</td></tr>`;
	}
}

// Fetch browser-based geolocation
async function fetchGeolocation() {
	const geoInfoTable = document.getElementById('geo-info-table');
	if (!geoInfoTable) return;

	if (!navigator.geolocation) {
		geoInfoTable.innerHTML = `<tr><td colspan="2" class="error">Geolocation is not supported by your browser</td></tr>`;
		return;
	}

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

			// Hide loading container and progress bar after completion
			setTimeout(() => {
				const loadingContainer = document.querySelector('#geo-info .loading-container');
				const progressContainer = document.querySelector('#geo-info .progress-bar');
				if (loadingContainer) loadingContainer.style.display = 'none';
				if (progressContainer) progressContainer.style.display = 'none';
			}, 500);
		},
		(error) => {
			let errorMsg = '';
			switch (error.code) {
				case error.PERMISSION_DENIED:
					errorMsg = 'User denied the request for Geolocation.';
					break;
				case error.POSITION_UNAVAILABLE:
					errorMsg = 'Location information is unavailable.';
					break;
				case error.TIMEOUT:
					errorMsg = 'The request to get user location timed out.';
					break;
				default:
					errorMsg = 'An unknown error occurred.';
			}
			geoInfoTable.innerHTML = `<tr><td colspan="2" class="error">Geolocation error: ${errorMsg}</td></tr>`;
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

	if (pos.altitude !== null) {
		rows += `<tr><td>Altitude</td><td>${pos.altitude.toFixed(2)} meters</td></tr>`;
	}
	if (pos.altitudeAccuracy !== null) {
		rows += `<tr><td>Altitude Accuracy</td><td>${pos.altitudeAccuracy.toFixed(2)} meters</td></tr>`;
	}
	if (pos.heading !== null) {
		rows += `<tr><td>Heading</td><td>${pos.heading.toFixed(2)} degrees</td></tr>`;
	}
	if (pos.speed !== null) {
		rows += `<tr><td>Speed</td><td>${pos.speed.toFixed(2)} m/s</td></tr>`;
	}

	geoInfoTable.innerHTML = rows;
}

function displayBrowserInfo() {
	const browserInfoTable = document.getElementById('browser-info-table');
	if (!browserInfoTable) return;

	updateProgress('browser-progress', 50);

	const nav = navigator;
	const screen = window.screen;

	updateProgress('browser-progress', 80);

	browserInfoTable.innerHTML = `
		<tr><td>User Agent</td><td>${nav.userAgent}</td></tr>
		<tr><td>Platform</td><td>${nav.platform}</td></tr>
		<tr><td>Language</td><td>${nav.language}</td></tr>
		<tr><td>Screen Resolution</td><td>${screen.width} x ${screen.height}</td></tr>
		<tr><td>Color Depth</td><td>${screen.colorDepth}-bit</td></tr>
		<tr><td>Cookies Enabled</td><td>${nav.cookieEnabled ? 'Yes' : 'No'}</td></tr>
		<tr><td>Online Status</td><td>${nav.onLine ? 'Online' : 'Offline'}</td></tr>
	`;

	updateProgress('browser-progress', 100);

	// Hide loading container and progress bar after completion
	setTimeout(() => {
		const loadingContainer = document.querySelector('#browser-info .loading-container');
		const progressContainer = document.querySelector('#browser-info .progress-bar');
		if (loadingContainer) loadingContainer.style.display = 'none';
		if (progressContainer) progressContainer.style.display = 'none';
	}, 500);
}

// Initialize on page load
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}

function init() {
	console.log('Initializing client info page...');
	fetchIPInfo().catch(err => console.error('IP Info Error:', err));
	fetchGeolocation().catch(err => console.error('Geolocation Error:', err));
	displayBrowserInfo();
}
