// IP-CAL lab dashboard.
//
// Auth is real server-side auth against the webServerCheck backend
// (separate project, reverse-proxied in at /service/serverCheck — see
// API_BASE below), session cookie based. No secrets or password logic
// live in this file — it only calls the API and reacts to its responses.

(function () {

	// ---- API auth client -----------------------------------------------
	var API_BASE = '/service/serverCheck';
	var DASHBOARD_PAGE = 'dashboard.html';
	var GATE_PAGE = 'serverInfo.html';
	var CHANGE_PASSWORD_PAGE = 'change-password.html';

	function apiFetch(path, opts) {
		opts = opts || {};
		return fetch(API_BASE + path, {
			method: opts.method || 'GET',
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			credentials: 'same-origin'
		}).then(function (res) {
			return res.json().catch(function () { return {}; }).then(function (data) {
				return { ok: res.ok, status: res.status, data: data };
			});
		});
	}

	function fetchMe() {
		return apiFetch('/auth/me').then(function (r) { return r.ok ? r.data.user : null; });
	}

	// ---- Gate page (serverInfo.html): real login against the API ---------
	function initGatePage() {
		var emailInput = document.getElementById('gate-email');
		var input = document.getElementById('gate-password');
		var button = document.getElementById('gate-submit');
		var error = document.getElementById('gate-error');
		var toggleBtn = document.getElementById('gate-toggle-password');

		toggleBtn.addEventListener('click', function () {
			input.type = (input.type === 'password') ? 'text' : 'password';
			input.focus();
		});

		// Already logged in? skip straight to the dashboard (also handles the
		// must-change-password redirect consistently with guardDashboardPage).
		fetchMe().then(function (user) {
			if (user) {
				location.href = user.mustChangePassword ? CHANGE_PASSWORD_PAGE : DASHBOARD_PAGE;
			}
		});

		function tryLogin() {
			error.hidden = true;
			apiFetch('/auth/login', { method: 'POST', body: { email: emailInput.value, password: input.value } })
				.then(function (r) {
					if (r.ok) {
						location.href = r.data.user.mustChangePassword ? CHANGE_PASSWORD_PAGE : DASHBOARD_PAGE;
					} else if (r.status === 429) {
						error.textContent = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
						error.hidden = false;
					} else {
						error.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
						error.hidden = false;
						input.value = '';
						input.focus();
					}
				});
		}

		button.addEventListener('click', tryLogin);
		[emailInput, input].forEach(function (el) {
			el.addEventListener('keydown', function (e) {
				if (e.key === 'Enter') tryLogin();
			});
		});
		emailInput.focus();
	}

	// ---- Dashboard page (dashboard.html): verify session, else bounce back --
	function guardDashboardPage() {
		return fetchMe().then(function (user) {
			if (!user) {
				location.href = GATE_PAGE;
				return null;
			}
			if (user.mustChangePassword) {
				location.href = CHANGE_PASSWORD_PAGE;
				return null;
			}
			return user;
		});
	}

	function initLogout() {
		var btn = document.getElementById('logout-btn');
		if (!btn) return;
		btn.addEventListener('click', function () {
			apiFetch('/auth/logout', { method: 'POST' }).then(function () {
				location.href = GATE_PAGE;
			});
		});
	}

	// Lighter guard than guardDashboardPage(): requires a session, but does
	// NOT bounce to change-password.html when mustChangePassword is true —
	// used by change-password.html itself, which must stay reachable.
	function requireLoggedIn() {
		return fetchMe().then(function (user) {
			if (!user) {
				location.href = GATE_PAGE;
				return null;
			}
			return user;
		});
	}

	// ---- change-password.html --------------------------------------------
	function initChangePasswordPage() {
		requireLoggedIn().then(function (user) {
			if (!user) return;
			var form = document.getElementById('change-password-form');
			var current = document.getElementById('current-password');
			var next = document.getElementById('new-password');
			var confirm = document.getElementById('confirm-password');
			var error = document.getElementById('change-password-error');
			var success = document.getElementById('change-password-success');
			var notice = document.getElementById('must-change-notice');
			if (notice) notice.hidden = !user.mustChangePassword;

			form.addEventListener('submit', function (e) {
				e.preventDefault();
				error.hidden = true;
				success.hidden = true;
				if (next.value !== confirm.value) {
					error.textContent = '새 비밀번호가 일치하지 않습니다.';
					error.hidden = false;
					return;
				}
				apiFetch('/auth/change-password', {
					method: 'POST',
					body: { currentPassword: current.value, newPassword: next.value }
				}).then(function (r) {
					if (r.ok) {
						success.hidden = false;
						setTimeout(function () { location.href = DASHBOARD_PAGE; }, 1200);
					} else {
						var messages = {
							CURRENT_PASSWORD_INCORRECT: '현재 비밀번호가 올바르지 않습니다.',
							PASSWORD_TOO_WEAK: '새 비밀번호는 최소 10자 이상이어야 합니다.',
							PASSWORD_MUST_DIFFER: '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
						};
						error.textContent = messages[r.data.error] || '비밀번호 변경에 실패했습니다.';
						error.hidden = false;
					}
				});
			});
		});
	}

	// ---- forgot-password.html ---------------------------------------------
	function initForgotPasswordPage() {
		var form = document.getElementById('forgot-password-form');
		var email = document.getElementById('forgot-email');
		var success = document.getElementById('forgot-password-success');
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			apiFetch('/auth/request-password-reset', { method: 'POST', body: { email: email.value } }).then(function () {
				form.hidden = true;
				success.hidden = false;
			});
		});
	}

	// ---- reset-password.html ------------------------------------------------
	function initResetPasswordPage() {
		var token = new URLSearchParams(location.search).get('token') || '';
		var form = document.getElementById('reset-password-form');
		var next = document.getElementById('reset-new-password');
		var confirm = document.getElementById('reset-confirm-password');
		var error = document.getElementById('reset-password-error');
		var success = document.getElementById('reset-password-success');

		if (!token) {
			error.textContent = '재설정 링크가 올바르지 않습니다. 이메일의 링크를 다시 확인해주세요.';
			error.hidden = false;
			form.hidden = true;
			return;
		}

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			error.hidden = true;
			if (next.value !== confirm.value) {
				error.textContent = '비밀번호가 일치하지 않습니다.';
				error.hidden = false;
				return;
			}
			apiFetch('/auth/reset-password', { method: 'POST', body: { token: token, newPassword: next.value } })
				.then(function (r) {
					if (r.ok) {
						form.hidden = true;
						success.hidden = false;
					} else {
						var messages = {
							INVALID_OR_EXPIRED_TOKEN: '링크가 만료되었거나 유효하지 않습니다. 다시 요청해주세요.',
							PASSWORD_TOO_WEAK: '비밀번호는 최소 10자 이상이어야 합니다.'
						};
						error.textContent = messages[r.data.error] || '비밀번호 재설정에 실패했습니다.';
						error.hidden = false;
					}
				});
		});
	}

	// ---- admin-users.html (admin only — server also enforces this) --------
	function initAdminUsersPage() {
		guardDashboardPage().then(function (user) {
			if (!user) return;
			if (user.role !== 'admin') {
				location.href = DASHBOARD_PAGE;
				return;
			}

			var list = document.getElementById('admin-user-list');
			var form = document.getElementById('create-user-form');
			var nameInput = document.getElementById('new-user-name');
			var emailInput = document.getElementById('new-user-email');
			var roleInput = document.getElementById('new-user-role');
			var error = document.getElementById('create-user-error');
			var reveal = document.getElementById('temp-password-reveal');

			function loadUsers() {
				apiFetch('/admin/users').then(function (r) {
					if (!r.ok) return;
					list.innerHTML = '';
					r.data.users.forEach(function (u) {
						var row = el('div', { class: 'user-row' });
						row.appendChild(el('span', { class: 'user-email', text: u.email }));
						row.appendChild(el('span', { class: 'user-name', text: u.name }));
						row.appendChild(el('span', { class: 'user-role role-' + u.role, text: u.role }));
						if (u.mustChangePassword) {
							row.appendChild(el('span', { class: 'user-pending', text: '비밀번호 미변경' }));
						}
						list.appendChild(row);
					});
				});
			}

			form.addEventListener('submit', function (e) {
				e.preventDefault();
				error.hidden = true;
				reveal.hidden = true;
				apiFetch('/admin/users', {
					method: 'POST',
					body: { name: nameInput.value, email: emailInput.value, role: roleInput.value }
				}).then(function (r) {
					if (r.ok) {
						reveal.textContent = r.data.user.email + ' 임시 비밀번호: ' + r.data.tempPassword + ' (다시 표시되지 않습니다 — 지금 복사해서 전달하세요)';
						reveal.hidden = false;
						form.reset();
						loadUsers();
					} else {
						var messages = {
							EMAIL_ALREADY_EXISTS: '이미 존재하는 이메일입니다.',
							INVALID_BODY: '입력값을 확인해주세요.'
						};
						error.textContent = messages[r.data.error] || '계정 생성에 실패했습니다.';
						error.hidden = false;
					}
				});
			});

			loadUsers();
		});
	}

	// ---- Live server status (from SSH-collected /status.json) -------------
	// Public JSON published by a Mac-side collector script. Contains only
	// name + usage numbers, never hostnames/IPs/usernames — see
	// /Volumes/web/monitor-status/status.json on the host. Matched to a
	// dashboard server entry by exact `name` match.
	var LIVE_STATUS_URL = '/status.json';
	var LIVE_POLL_MS = 30000;
	var liveStatus = {};

	function formatAgo(ts) {
		if (!ts) return '';
		var diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
		if (diff < 60) return diff + '초 전';
		if (diff < 3600) return Math.floor(diff / 60) + '분 전';
		return Math.floor(diff / 3600) + '시간 전';
	}

	function fetchLiveStatus() {
		fetch(LIVE_STATUS_URL, { cache: 'no-store' })
			.then(function (res) { return res.ok ? res.json() : null; })
			.then(function (data) {
				if (!data || !data.servers) return;
				var next = {};
				data.servers.forEach(function (s) { next[s.name] = s; });
				liveStatus = next;
				renderServers();
			})
			.catch(function () { /* keep last known liveStatus */ });
	}

	function initLiveStatusPolling() {
		fetchLiveStatus();
		setInterval(fetchLiveStatus, LIVE_POLL_MS);
	}

	function liveBadge(live) {
		var isAlive = !!live.alive;
		var badge = el('span', {
			class: 'status-badge live-badge ' + (isAlive ? 'status-online' : 'status-offline'),
			title: '실시간 모니터링 (자동 갱신, 클릭으로 수동 변경 불가)'
		});
		badge.textContent = (isAlive ? '● Live' : '● Down') + ' · ' + formatAgo(live.checked_at);
		return badge;
	}

	function usageRow(label, percent, note) {
		var row = el('div', { class: 'usage-row' });
		row.appendChild(el('div', { class: 'usage-label', text: label }));
		var barWrap = el('div', { class: 'usage-bar' });
		var pct = (typeof percent === 'number' && !isNaN(percent)) ? Math.max(0, Math.min(100, percent)) : null;
		var fill = el('div', { class: 'usage-bar-fill' + (pct !== null && pct >= 85 ? ' usage-high' : '') });
		fill.style.width = (pct !== null ? pct : 0) + '%';
		barWrap.appendChild(fill);
		row.appendChild(barWrap);
		row.appendChild(el('div', { class: 'usage-value', text: (pct !== null ? pct + '%' : '—') + (note ? ' · ' + note : '') }));
		return row;
	}

	function buildLiveStatsPanel(container, live) {
		var panel = el('div', { class: 'live-panel' });
		panel.appendChild(el('div', {
			class: 'live-panel-title',
			text: '실시간 상태 — ' + (live.alive ? '정상 응답' : '응답 없음') + ' (' + formatAgo(live.checked_at) + ' 갱신)'
		}));
		if (!live.alive) {
			container.appendChild(panel);
			return;
		}
		if (live.cpu) {
			var extra = [];
			if (live.cpu.load_avg) extra.push('load ' + live.cpu.load_avg.join('/'));
			if (live.cpu.cores) extra.push(live.cpu.cores + ' cores');
			panel.appendChild(usageRow('CPU', live.cpu.percent, extra.join(' · ')));
		}
		if (live.mem && live.mem.total_mb) {
			var memPct = Math.round((live.mem.used_mb / live.mem.total_mb) * 100);
			panel.appendChild(usageRow('메모리', memPct, live.mem.used_mb + ' / ' + live.mem.total_mb + ' MB'));
		}
		(live.disk || []).forEach(function (d) {
			panel.appendChild(usageRow('디스크 ' + d.mount, d.use_percent, d.used + ' / ' + d.size));
		});
		(live.gpu || []).forEach(function (g) {
			panel.appendChild(usageRow(
				'GPU ' + g.index,
				g.util_percent,
				Math.round(g.mem_used_mb) + ' / ' + Math.round(g.mem_total_mb) + ' MB · ' + g.temp_c + '°C'
			));
		});
		container.appendChild(panel);
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
			var live = opts.liveLookup ? opts.liveLookup(d) : null;
			if (live) {
				row.appendChild(liveBadge(live));
			} else {
				row.appendChild(statusBadge(
					function () { return d.status; },
					function (v) { d.status = v; },
					null
				));
			}
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
			liveLookup: function (d) { return liveStatus[d.name]; },
			buildFields: function (container, s, idx, rerender) {
				var live = liveStatus[s.name];
				if (live) buildLiveStatsPanel(container, live);
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
			guardDashboardPage().then(function (user) {
				if (!user) return;
				var adminLink = document.getElementById('admin-users-link');
				if (adminLink) adminLink.hidden = (user.role !== 'admin');
				initLogout();
				initAddRouter();
				initAddServer();
				initAck();
				renderAll();
				initLiveStatusPolling();
			});
		} else if (document.getElementById('change-password-page')) {
			initChangePasswordPage();
		} else if (document.getElementById('forgot-password-page')) {
			initForgotPasswordPage();
		} else if (document.getElementById('reset-password-page')) {
			initResetPasswordPage();
		} else if (document.getElementById('admin-users-page')) {
			initAdminUsersPage();
		}
	});

})();
