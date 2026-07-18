// IP-CAL lab dashboard.
//
// IMPORTANT — read before putting real data in here:
// This is a static site whose HTML/CSS/JS are committed to a PUBLIC GitHub
// repo. The password hash itself lives in Lab/internal/auth.info, a file
// that is git-ignored (see .gitignore) and never committed — so it's
// blank/missing on the public GitHub Pages deployment, and the gate simply
// won't open there. It only works on hosts where you've manually placed a
// real Lab/internal/auth.info file outside of git (e.g. copied it directly
// onto your own server). Even so, this is still a client-side check, not
// real server-side auth — anyone who can reach a working copy of auth.info
// (e.g. by requesting the file directly) can read the hash. Don't treat this
// as a substitute for keeping genuinely sensitive values (router admin
// password, etc.) out of any field you're not comfortable being seen.
//
// To keep this safe:
//   - NEVER hardcode real secrets (router admin password, SSH ports, IPs,
//     etc.) into this file or into serverInfo.html / dashboard.html.
//     Anything typed here in source form is permanently public, even after
//     you delete it later (git history keeps it).
//   - Real values should only ever be entered through the "Edit" buttons on
//     the dashboard. Those are stored in this browser's localStorage only —
//     they are never sent anywhere and never committed to git. That also
//     means they only exist on the device/browser where they were entered;
//     they will not show up for other lab members or on other machines.
//   - To change the password, compute a new SHA-256 hex hash yourself (e.g.
//     `echo -n 'newPassword' | shasum -a 256`) and replace the contents of
//     Lab/internal/auth.info on your server with just that hash.

(function () {

	// ---- Password gate -----------------------------------------------
	var GATE_INFO_URL = 'auth.info';
	var GATE_SESSION_KEY = 'ipcal_log_unlocked';
	var DASHBOARD_PAGE = 'dashboard.html';
	var GATE_PAGE = 'serverInfo.html';

	function sha256Hex(text) {
		var data = new TextEncoder().encode(text);
		return crypto.subtle.digest('SHA-256', data).then(function (buf) {
			return Array.prototype.map.call(new Uint8Array(buf), function (b) {
				return b.toString(16).padStart(2, '0');
			}).join('');
		});
	}

	function loadGateHash() {
		return fetch(GATE_INFO_URL, { cache: 'no-store' })
			.then(function (res) {
				if (!res.ok) {
					console.warn('internal.js: auth.info fetch returned', res.status, '— tried', res.url);
					return '';
				}
				return res.text();
			})
			.then(function (text) { return text.trim(); })
			.catch(function (err) {
				console.warn('internal.js: auth.info fetch failed —', err);
				return '';
			});
	}

	// ---- Gate page (serverInfo.html): checks the password, then redirects ---
	function initGatePage() {
		var input = document.getElementById('gate-password');
		var button = document.getElementById('gate-submit');
		var error = document.getElementById('gate-error');
		var toggleBtn = document.getElementById('gate-toggle-password');

		toggleBtn.addEventListener('click', function () {
			input.type = (input.type === 'password') ? 'text' : 'password';
			input.focus();
		});

		loadGateHash().then(function (expectedHash) {
			if (!expectedHash) {
				error.textContent = '이 서버에는 auth.info 설정 파일이 없어서 로그인할 수 없습니다.';
				error.hidden = false;
				input.disabled = true;
				button.disabled = true;
				return;
			}

			if (sessionStorage.getItem(GATE_SESSION_KEY) === expectedHash) {
				location.href = DASHBOARD_PAGE;
				return;
			}

			function tryUnlock() {
				sha256Hex(input.value).then(function (hex) {
					if (hex === expectedHash) {
						sessionStorage.setItem(GATE_SESSION_KEY, expectedHash);
						location.href = DASHBOARD_PAGE;
					} else {
						error.textContent = '비밀번호가 올바르지 않습니다.';
						error.hidden = false;
						input.value = '';
						input.focus();
					}
				});
			}

			button.addEventListener('click', tryUnlock);
			input.addEventListener('keydown', function (e) {
				if (e.key === 'Enter') tryUnlock();
			});
			input.focus();
		});
	}

	// ---- Dashboard page (dashboard.html): verify session, else bounce back --
	function guardDashboardPage() {
		return loadGateHash().then(function (expectedHash) {
			var stored = sessionStorage.getItem(GATE_SESSION_KEY);
			if (!expectedHash || stored !== expectedHash) {
				location.href = GATE_PAGE;
				return false;
			}
			return true;
		});
	}

	function initLogout() {
		var btn = document.getElementById('logout-btn');
		if (!btn) return;
		btn.addEventListener('click', function () {
			sessionStorage.removeItem(GATE_SESSION_KEY);
			location.href = GATE_PAGE;
		});
	}

	// ---- Data model -----------------------------------------------------
	var STORAGE_KEY = 'ipcal_log_data_v1';

	function defaultRouter() {
		return { name: 'router-01', adminUrl: '', id: 'TBD', password: 'TBD', notes: '', status: 'online' };
	}

	function defaultServer() {
		return {
			name: 'server-01', cpu: 'TBD', gpu: 'TBD', memSlots: 'TBD', memPerSlot: 'TBD',
			ssd: ['TBD'], power: 'TBD', ip: 'TBD', sshPort: 'TBD', notes: '', status: 'online'
		};
	}

	function defaultData() {
		return {
			routers: [defaultRouter()],
			servers: [defaultServer()],
			ack: 'This work was supported by ... (편집 버튼으로 실제 사사 문구를 입력하세요.)'
		};
	}

	function loadData() {
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return defaultData();
			var parsed = JSON.parse(raw);
			var d = defaultData();
			return {
				routers: (parsed.routers && parsed.routers.length) ? parsed.routers : d.routers,
				servers: (parsed.servers && parsed.servers.length) ? parsed.servers : d.servers,
				ack: (typeof parsed.ack === 'string') ? parsed.ack : d.ack
			};
		} catch (e) {
			return defaultData();
		}
	}

	var state = loadData();

	function save() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}

	// ---- Small render helpers --------------------------------------------
	function el(tag, attrs, children) {
		var node = document.createElement(tag);
		attrs = attrs || {};
		Object.keys(attrs).forEach(function (k) {
			if (k === 'text') node.textContent = attrs[k];
			else if (k === 'html') node.innerHTML = attrs[k];
			else node.setAttribute(k, attrs[k]);
		});
		(children || []).forEach(function (c) { node.appendChild(c); });
		return node;
	}

	// Renders one label/value row with an inline edit control.
	function fieldRow(label, getValue, setValue, onChange, opts) {
		opts = opts || {};
		var row = el('div', { class: 'field-row' });
		var labelEl = el('div', { class: 'field-label', text: label });
		var valueWrap = el('div', { class: 'field-value-wrap' });
		row.appendChild(labelEl);
		row.appendChild(valueWrap);

		function renderView() {
			valueWrap.innerHTML = '';
			var display = getValue() || '—';
			var valueEl;
			if (opts.secret) {
				var shown = false;
				valueEl = el('span', { class: 'field-value secret', text: '••••••••' });
				var toggle = el('button', { class: 'icon-btn', type: 'button', title: 'Show/hide' });
				toggle.textContent = '👁';
				toggle.addEventListener('click', function () {
					shown = !shown;
					valueEl.textContent = shown ? display : '••••••••';
				});
				valueWrap.appendChild(valueEl);
				valueWrap.appendChild(toggle);
			} else if (opts.link && getValue()) {
				valueEl = el('a', { class: 'field-value', href: getValue(), target: '_blank', rel: 'noopener', text: display });
				valueWrap.appendChild(valueEl);
			} else {
				valueEl = el('span', { class: 'field-value', text: display });
				valueWrap.appendChild(valueEl);
			}
			var editBtn = el('button', { class: 'icon-btn edit-btn', type: 'button', title: 'Edit' });
			editBtn.textContent = '✏️';
			editBtn.addEventListener('click', renderEdit);
			valueWrap.appendChild(editBtn);
		}

		function renderEdit() {
			valueWrap.innerHTML = '';
			var input = el('input', { class: 'field-input', type: 'text', value: getValue() || '' });
			var saveBtn = el('button', { class: 'icon-btn', type: 'button', title: 'Save' });
			saveBtn.textContent = '✅';
			var cancelBtn = el('button', { class: 'icon-btn', type: 'button', title: 'Cancel' });
			cancelBtn.textContent = '✖️';
			function commit() {
				setValue(input.value);
				save();
				if (onChange) onChange();
				renderView();
			}
			saveBtn.addEventListener('click', commit);
			cancelBtn.addEventListener('click', renderView);
			input.addEventListener('keydown', function (e) {
				if (e.key === 'Enter') commit();
				if (e.key === 'Escape') renderView();
			});
			valueWrap.appendChild(input);
			valueWrap.appendChild(saveBtn);
			valueWrap.appendChild(cancelBtn);
			input.focus();
		}

		renderView();
		return row;
	}

	// A small clickable dot: green ("online") <-> blue ("offline"). Purely
	// manual — a static page can't actually reach into your LAN to ping
	// anything, so this just records what a lab member last set it to.
	function statusBadge(getStatus, setStatus, onChange) {
		var btn = el('button', { type: 'button', class: 'status-badge', title: '클릭해서 상태 변경' });
		function render() {
			var isOnline = getStatus() !== 'offline';
			btn.className = 'status-badge ' + (isOnline ? 'status-online' : 'status-offline');
			btn.textContent = isOnline ? '● Online' : '● Offline';
		}
		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			setStatus(getStatus() === 'offline' ? 'online' : 'offline');
			save();
			render();
			if (onChange) onChange();
		});
		render();
		return btn;
	}

	// Renders a collapsible list of devices (routers or servers).
	// buildFields(container, device, index, rerenderList) fills in the
	// detail card body for one expanded device.
	function renderDeviceList(listEl, devices, opts) {
		listEl.innerHTML = '';
		devices.forEach(function (d, idx) {
			var expanded = !!d._expanded;

			var item = el('div', { class: 'device-item' });
			var row = el('div', { class: 'device-row' });
			var arrow = el('span', { class: 'device-arrow', text: expanded ? '▾' : '▸' });
			var name = el('span', { class: 'device-name', text: d.name || opts.defaultName(idx) });
			row.appendChild(arrow);
			row.appendChild(name);
			row.appendChild(statusBadge(
				function () { return d.status; },
				function (v) { d.status = v; },
				null
			));
			row.addEventListener('click', function () {
				d._expanded = !d._expanded;
				renderDeviceList(listEl, devices, opts);
			});
			item.appendChild(row);

			if (expanded) {
				var details = el('div', { class: 'card device-details' });
				opts.buildFields(details, d, idx, function () { renderDeviceList(listEl, devices, opts); });

				var removeBtn = el('button', { class: 'remove-btn', type: 'button', text: '삭제' });
				removeBtn.addEventListener('click', function (e) {
					e.stopPropagation();
					if (!confirm('삭제할까요? (이 브라우저에서만 삭제됩니다)')) return;
					devices.splice(idx, 1);
					save();
					renderDeviceList(listEl, devices, opts);
				});
				details.appendChild(removeBtn);

				item.appendChild(details);
			}

			listEl.appendChild(item);
		});
	}

	// ---- Routers ----------------------------------------------------------
	function renderRouters() {
		renderDeviceList(document.getElementById('router-list'), state.routers, {
			defaultName: function (idx) { return 'router-' + (idx + 1); },
			buildFields: function (container, r, idx, rerender) {
				function field(label, key, opts) {
					container.appendChild(fieldRow(label, function () { return r[key]; }, function (v) { r[key] = v; }, rerender, opts));
				}
				field('공유기 이름', 'name');
				field('관리자 페이지 링크', 'adminUrl', { link: true });
				field('로그인 ID', 'id');
				field('로그인 비밀번호', 'password', { secret: true });
				field('비고', 'notes');
				if (r.adminUrl) {
					container.appendChild(el('a', { class: 'open-btn', href: r.adminUrl, target: '_blank', rel: 'noopener', text: '공유기 설정 페이지 열기 →' }));
				}
			}
		});
	}

	function initAddRouter() {
		document.getElementById('add-router').addEventListener('click', function () {
			var r = defaultRouter();
			r.name = 'new-router';
			r._expanded = true;
			state.routers.push(r);
			save();
			renderRouters();
		});
	}

	// ---- Servers ------------------------------------------------------------
	function renderServers() {
		renderDeviceList(document.getElementById('server-list'), state.servers, {
			defaultName: function (idx) { return 'server-' + (idx + 1); },
			buildFields: function (container, s, idx, rerender) {
				function field(label, key, opts) {
					container.appendChild(fieldRow(label, function () { return s[key]; }, function (v) { s[key] = v; }, rerender, opts));
				}
				field('서버 이름', 'name');
				field('CPU', 'cpu');
				field('GPU', 'gpu');
				field('메모리 슬롯 수', 'memSlots');
				field('슬롯당 용량', 'memPerSlot');
				field('전원(파워)', 'power');
				field('IP', 'ip');
				field('SSH 포트', 'sshPort', { secret: true });
				field('비고', 'notes');

				var ssdWrap = el('div', { class: 'field-row' });
				ssdWrap.appendChild(el('div', { class: 'field-label', text: 'SSD' }));
				var ssdList = el('div', { class: 'ssd-list' });
				(s.ssd || []).forEach(function (val, ssdIdx) {
					var line = el('div', { class: 'field-value-wrap' });
					line.appendChild(fieldRow('', function () { return s.ssd[ssdIdx]; }, function (v) { s.ssd[ssdIdx] = v; }, rerender));
					var delBtn = el('button', { class: 'icon-btn', type: 'button', title: 'Remove this drive' });
					delBtn.textContent = '🗑';
					delBtn.addEventListener('click', function () {
						s.ssd.splice(ssdIdx, 1);
						if (s.ssd.length === 0) s.ssd.push('TBD');
						save();
						rerender();
					});
					line.appendChild(delBtn);
					ssdList.appendChild(line);
				});
				var addSsdBtn = el('button', { class: 'add-btn', type: 'button', text: '+ SSD 추가' });
				addSsdBtn.addEventListener('click', function () {
					s.ssd.push('TBD');
					save();
					rerender();
				});
				ssdWrap.appendChild(ssdList);
				ssdWrap.appendChild(addSsdBtn);
				container.appendChild(ssdWrap);
			}
		});
	}

	function initAddServer() {
		document.getElementById('add-server').addEventListener('click', function () {
			var s = defaultServer();
			s.name = 'new-server';
			s._expanded = true;
			state.servers.push(s);
			save();
			renderServers();
		});
	}

	// ---- Acknowledgement section -------------------------------------------
	function renderAck() {
		var view = document.getElementById('ack-view');
		var textarea = document.getElementById('ack-edit-area');
		view.textContent = state.ack;
		textarea.value = state.ack;
	}

	function initAck() {
		var view = document.getElementById('ack-view');
		var textarea = document.getElementById('ack-edit-area');
		var editBtn = document.getElementById('ack-edit-btn');
		var saveBtn = document.getElementById('ack-save-btn');
		var cancelBtn = document.getElementById('ack-cancel-btn');
		var copyBtn = document.getElementById('ack-copy-btn');
		var copiedMsg = document.getElementById('ack-copied');

		editBtn.addEventListener('click', function () {
			view.hidden = true;
			editBtn.hidden = true;
			textarea.hidden = false;
			saveBtn.hidden = false;
			cancelBtn.hidden = false;
			textarea.focus();
		});
		function stopEditing() {
			view.hidden = false;
			editBtn.hidden = false;
			textarea.hidden = true;
			saveBtn.hidden = true;
			cancelBtn.hidden = true;
		}
		saveBtn.addEventListener('click', function () {
			state.ack = textarea.value;
			save();
			renderAck();
			stopEditing();
		});
		cancelBtn.addEventListener('click', function () {
			textarea.value = state.ack;
			stopEditing();
		});
		copyBtn.addEventListener('click', function () {
			navigator.clipboard.writeText(state.ack).then(function () {
				copiedMsg.hidden = false;
				setTimeout(function () { copiedMsg.hidden = true; }, 1500);
			});
		});
	}

	function renderAll() {
		renderRouters();
		renderServers();
		renderAck();
	}

	document.addEventListener('DOMContentLoaded', function () {
		if (document.getElementById('gate')) {
			initGatePage();
		} else if (document.getElementById('dashboard')) {
			guardDashboardPage().then(function (ok) {
				if (!ok) return;
				initLogout();
				initAddRouter();
				initAddServer();
				initAck();
				renderAll();
			});
		}
	});

})();
