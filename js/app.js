class CommandManager {
    constructor() {
        const data = (typeof COMMAND_DATA !== 'undefined') ? COMMAND_DATA : { commands: [], certifications: [] };
        this.commands = data.commands || [];
        this.certifications = data.certifications || [];
        this.types = data.types || [...new Set(this.commands.map(c => c.type || 'command'))].sort();
        this.total = this.commands.length;

        // id -> card, and reverse chain index (who recommends this card)
        this.byId = {};
        this.commands.forEach(c => { this.byId[c.id] = c; });
        this.reverseRec = {};
        this.commands.forEach(c => (c.recommended || []).forEach(r => {
            if (!r || !r.id) return;
            (this.reverseRec[r.id] = this.reverseRec[r.id] || []).push({ id: c.id, rel: r.rel, note: r.note });
        }));

        this.defaultFilters = { search: '', cert: 'all', type: 'all', platform: 'all', opsec: 'all', requires: 'all', protocol: 'all', tool: 'all', category: 'all' };
        this.filters = Object.assign({}, this.defaultFilters);

        this.showFavoritesOnly = false;
        this.favorites = this.loadFavorites();
        this.showRecentOnly = false;
        this.recent = this.loadRecent();               // array of card ids, most-recent first
        this.collections = this.loadCollections();     // { name: [ids] } - your curated sets
        this.showCollection = '';                      // active collection view filter

        this.authTab = 0;                  // 0 = Default, 1..n = variations index+1
        this.paramValues = this.loadContext();
        this.engagements = this.loadEngagements();     // { name: {var: value, ...} }
        this.activeEng = this.loadActiveEng();
        this.userNotes = this.loadUserNotes();         // { cardId: "your note" }
        this.selectedCommand = null;
        this.mode = this.loadMode();       // 'red' | 'blue' | 'both'
        this.builderTab = 'attack';        // 'attack' | 'understand' | 'defend'

        this.init();
    }

    /* ---------- persistence ---------- */
    loadFavorites() {
        try { return new Set(JSON.parse(localStorage.getItem('cr_favorites') || '[]')); }
        catch (e) { return new Set(); }
    }
    saveFavorites() {
        try { localStorage.setItem('cr_favorites', JSON.stringify([...this.favorites])); } catch (e) {}
    }
    loadRecent() { try { return JSON.parse(localStorage.getItem('cr_recent') || '[]'); } catch (e) { return []; } }
    saveRecent() { try { localStorage.setItem('cr_recent', JSON.stringify(this.recent)); } catch (e) {} }
    pushRecent(id) {
        this.recent = [id, ...this.recent.filter(x => x !== id)].slice(0, 25);
        this.saveRecent();
    }
    /* ---------- collections (named curated sets of cards) ---------- */
    loadCollections() { try { return JSON.parse(localStorage.getItem('cr_collections') || '{}'); } catch (e) { return {}; } }
    saveCollections() { try { localStorage.setItem('cr_collections', JSON.stringify(this.collections)); } catch (e) {} }
    collectionNames() { return Object.keys(this.collections).sort((a, b) => a.localeCompare(b)); }
    isInCollection(name, id) { return (this.collections[name] || []).includes(id); }
    toggleInCollection(name, id) {
        const arr = this.collections[name] || (this.collections[name] = []);
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1); else arr.push(id);
        this.saveCollections();
    }
    createCollection(name) { if (name && !this.collections[name]) { this.collections[name] = []; this.saveCollections(); } }
    deleteCollection(name) { delete this.collections[name]; if (this.showCollection === name) this.showCollection = ''; this.saveCollections(); }
    cardInAnyCollection(id) { return Object.values(this.collections).some(arr => arr.includes(id)); }
    // Popover: checkboxes to toggle the current card in each collection, plus create/delete.
    renderCollPop(cmd) {
        const pop = document.getElementById('collPop');
        if (!pop) return;
        const names = this.collectionNames();
        const rows = names.length ? names.map(n =>
            '<div class="coll-row"><label><input type="checkbox" data-coll="' + this.esc(n) + '"' + (this.isInCollection(n, cmd.id) ? ' checked' : '') + '> ' + this.esc(n) + '</label>' +
            '<button class="coll-del" data-delcoll="' + this.esc(n) + '" title="Delete collection">&times;</button></div>'
        ).join('') : '<div class="coll-empty">No collections yet.</div>';
        pop.innerHTML = rows +
            '<div class="coll-new"><input id="collNewName" placeholder="New collection"><button id="collAdd">Add</button></div>';
        pop.querySelectorAll('[data-coll]').forEach(cb => cb.addEventListener('change', () => {
            this.toggleInCollection(cb.dataset.coll, cmd.id);
            this.renderCollectionFilter();
            this.updateCollDot(cmd.id);
        }));
        pop.querySelectorAll('[data-delcoll]').forEach(b => b.addEventListener('click', () => {
            if (confirm('Delete collection "' + b.dataset.delcoll + '"?')) {
                this.deleteCollection(b.dataset.delcoll);
                this.renderCollectionFilter(); this.renderCollPop(cmd); this.updateCollDot(cmd.id);
            }
        }));
        const addBtn = pop.querySelector('#collAdd'), nameInp = pop.querySelector('#collNewName');
        const doAdd = () => {
            const name = (nameInp.value || '').trim();
            if (!name) return;
            this.createCollection(name);
            this.toggleInCollection(name, cmd.id);
            this.renderCollectionFilter(); this.renderCollPop(cmd); this.updateCollDot(cmd.id);
        };
        if (addBtn) addBtn.addEventListener('click', doAdd);
        if (nameInp) nameInp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    }
    updateCollDot(id) {
        const card = document.querySelector('.command-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"] .card-title');
        if (!card) return;
        const ex = card.querySelector('.coll-dot');
        const should = this.cardInAnyCollection(id);
        if (should && !ex) card.insertAdjacentHTML('beforeend', '<span class="coll-dot" title="In a collection"><i class="fas fa-bookmark"></i></span>');
        if (!should && ex) ex.remove();
    }
    renderCollectionFilter() {
        const sel = document.getElementById('collectionFilter');
        if (!sel) return;
        const names = this.collectionNames();
        sel.innerHTML = '<option value="">All collections</option>' +
            names.map(n => '<option value="' + this.esc(n) + '"' + (n === this.showCollection ? ' selected' : '') + '>' + this.esc(n) + ' (' + this.collections[n].length + ')</option>').join('');
    }
    loadContext() {
        try { return JSON.parse(localStorage.getItem('cr_context') || '{}'); }
        catch (e) { return {}; }
    }
    saveContext() {
        try { localStorage.setItem('cr_context', JSON.stringify(this.paramValues)); } catch (e) {}
    }

    /* ---------- named engagements (saved target-variable sets) ---------- */
    loadEngagements() { try { return JSON.parse(localStorage.getItem('cr_engagements') || '{}'); } catch (e) { return {}; } }
    saveEngagements() { try { localStorage.setItem('cr_engagements', JSON.stringify(this.engagements)); } catch (e) {} }
    loadActiveEng() { try { return localStorage.getItem('cr_active_eng') || ''; } catch (e) { return ''; } }
    setActiveEng(name) { this.activeEng = name || ''; try { localStorage.setItem('cr_active_eng', this.activeEng); } catch (e) {} }

    renderEngSelect() {
        const sel = document.getElementById('engSelect');
        if (!sel) return;
        const names = Object.keys(this.engagements).sort((a, b) => a.localeCompare(b));
        sel.innerHTML = '<option value="">— context —</option>' +
            names.map(n => '<option value="' + this.esc(n) + '"' + (n === this.activeEng ? ' selected' : '') + '>' + this.esc(n) + '</option>').join('');
    }

    switchEngagement(name) {
        if (name && this.engagements[name]) {
            this.paramValues = Object.assign({}, this.engagements[name]);
        } else {
            this.paramValues = {};                     // "— context —" clears to a blank working set
        }
        this.setActiveEng(name);
        this.saveContext();
        this.buildContextBar();
        if (this.selectedCommand) this.renderBuilder();
    }

    saveEngagement(name) {
        if (!name) return;
        this.engagements[name] = Object.assign({}, this.paramValues);
        this.saveEngagements();
        this.setActiveEng(name);
        this.renderEngSelect();
        this.toast('Saved "' + name + '"');
    }

    deleteEngagement(name) {
        if (!name || !this.engagements[name]) return;
        delete this.engagements[name];
        this.saveEngagements();
        if (this.activeEng === name) this.setActiveEng('');
        this.renderEngSelect();
        this.toast('Deleted "' + name + '"');
    }

    exportEngagements() {
        const blob = new Blob([JSON.stringify({ engagements: this.engagements, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'engagements.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    importEngagements(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                const incoming = data.engagements || data;   // accept {engagements:{}} or a raw map
                let n = 0;
                for (const [name, vars] of Object.entries(incoming)) {
                    if (vars && typeof vars === 'object') { this.engagements[name] = vars; n++; }
                }
                this.saveEngagements();
                this.renderEngSelect();
                this.toast('Imported ' + n + ' engagement(s)');
            } catch (e) { this.toast('Import failed - invalid file'); }
        };
        reader.readAsText(file);
    }

    /* ---------- reporting bridge: push a card into the Exam Mode findings log ---------- */
    // Both pages share localStorage (same origin), so this appends to `exam_findings`; the record
    // appears in Exam Mode's Findings tab (and its report export) next time that page loads.
    sendToFindings(cmd) {
        let findings = [];
        try { findings = JSON.parse(localStorage.getItem('exam_findings') || '[]'); } catch (e) {}
        findings.push({
            id: Math.random().toString(36).slice(2, 9),
            severity: 'Info', host: this.paramValues.ip || '', cvss: '', evidence: '',
            title: cmd.name,
            command: this.substitute(this.activeCommandString()),
            steps: (cmd.steps || []).map(s => this.substitute(s.command)).join('\n'),
            impact: '', remediation: ''
        });
        try { localStorage.setItem('exam_findings', JSON.stringify(findings)); } catch (e) {}
        this.toast('Added to Exam findings');
    }

    /* ---------- personal notes (your annotations on any card) ---------- */
    loadUserNotes() { try { return JSON.parse(localStorage.getItem('cr_notes') || '{}'); } catch (e) { return {}; } }
    saveUserNotes() { try { localStorage.setItem('cr_notes', JSON.stringify(this.userNotes)); } catch (e) {} }
    getUserNote(id) { return this.userNotes[id] || ''; }
    setUserNote(id, text) {
        if (text && text.trim()) this.userNotes[id] = text;
        else delete this.userNotes[id];
        this.saveUserNotes();
    }

    /* ---------- red / blue / both mode ---------- */
    loadMode() { try { return localStorage.getItem('cr_mode') || 'red'; } catch(e) { return 'red'; } }
    saveMode() { try { localStorage.setItem('cr_mode', this.mode); } catch(e) {} }
    applyMode() {
        document.body.dataset.mode = this.mode;
        document.querySelectorAll('#modeToggle .mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.mode);
        });
    }
    isBlueCard(cmd) { return (cmd.certifications || []).includes('CDSA'); }

    /* ---------- full backup / restore (favorites + notes + engagements + context) ---------- */
    exportAllData() {
        const payload = {
            _type: 'command-reference-backup', exported: new Date().toISOString(),
            favorites: [...this.favorites], notes: this.userNotes,
            engagements: this.engagements, context: this.paramValues,
            collections: this.collections, recent: this.recent,
            studyWeak: [...(this.studyWeak || this.loadStudyWeak())]
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'command-reference-backup.json';
        a.click();
        URL.revokeObjectURL(a.href);
        this.toast('Backup downloaded');
    }
    importAllData(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const d = JSON.parse(reader.result);
                if (Array.isArray(d.favorites)) { this.favorites = new Set(d.favorites); this.saveFavorites(); }
                if (d.notes && typeof d.notes === 'object') { this.userNotes = Object.assign(this.userNotes, d.notes); this.saveUserNotes(); }
                if (d.engagements && typeof d.engagements === 'object') { this.engagements = Object.assign(this.engagements, d.engagements); this.saveEngagements(); }
                if (d.context && typeof d.context === 'object') { this.paramValues = d.context; this.saveContext(); }
                if (d.collections && typeof d.collections === 'object') { this.collections = Object.assign(this.collections, d.collections); this.saveCollections(); }
                if (Array.isArray(d.recent)) { this.recent = d.recent; this.saveRecent(); }
                if (Array.isArray(d.studyWeak)) { this.studyWeak = new Set(d.studyWeak); this.saveStudyWeak(); }
                this.renderEngSelect(); this.renderCollectionFilter(); this.buildContextBar(); this.renderCommands();
                if (this.selectedCommand) this.renderBuilder();
                this.toast('Backup restored');
            } catch (e) { this.toast('Restore failed - invalid file'); }
        };
        reader.readAsText(file);
    }

    init() {
        this.showAllVars = false;
        this.populateFilterOptions();
        this.buildCategoryTree();
        this.buildContextBar();
        this.renderEngSelect();
        this.renderCollectionFilter();
        this.bindEvents();
        this.applyMode();
        this.renderCommands();
        this.updateCommandCount();
    }

    // Which canonical engagement vars actually appear anywhere in the loaded card set.
    // Only these get a field - the bar never shows variables no command uses.
    presentVars() {
        if (this._presentVars) return this._presentVars;
        const canon = (typeof canonVar === 'function') ? canonVar : (() => null);
        const present = new Set();
        const scan = s => { (String(s || '').match(/<([a-zA-Z0-9_\-]+)>/g) || []).forEach(m => {
            const key = canon(m.slice(1, -1)); if (key) present.add(key);
        }); };
        this.commands.forEach(c => {
            scan(c.command);
            (c.variations || []).forEach(v => scan(v.command));
            (c.steps || []).forEach(v => scan(v.command));
            (c.examples || []).forEach(e => scan(typeof e === 'string' ? e : e && e.command));
        });
        this._presentVars = present;
        return present;
    }

    // Build the Target Context bar from the canonical registry, grouped, core visible +
    // the rest under a "Show all variables" toggle. Driven entirely by vars.js - add a
    // variable there and it appears here automatically.
    buildContextBar() {
        const reg = (typeof VAR_REGISTRY !== 'undefined') ? VAR_REGISTRY : [];
        const el = document.getElementById('tcFields');
        if (!el) return;
        const present = this.presentVars();
        const order = ['Target', 'Auth', 'Active Directory', 'Attacker', 'Services', 'Files'];
        // ordered by group (so related fields cluster) but rendered as one inline row
        const shown = reg.filter(v => present.has(v.key) && (this.showAllVars || v.core))
            .sort((a, b) => {
                const ia = order.indexOf(a.group), ib = order.indexOf(b.group);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
        el.innerHTML = shown.map(v => {
            const val = this.paramValues[v.key] || '';
            const filled = val ? ' filled' : '';
            return '<div class="tc-field' + filled + '" data-group="' + this.esc(v.group) + '">' +
                '<label title="' + this.esc(v.group + ' · ' + v.label) + '">' + this.esc(v.label) + '</label>' +
                '<input type="text" data-param="' + this.esc(v.key) + '" placeholder="—" value="' + this.esc(val) + '"></div>';
        }).join('');

        // count of extra (non-core, present) vars for the toggle label
        const extra = reg.filter(v => present.has(v.key) && !v.core).length;
        const btn = document.getElementById('tcToggle');
        if (btn) btn.textContent = this.showAllVars ? 'Show core only' : ('Show all variables (' + extra + ' more)');

        // wire the newly rendered inputs
        el.querySelectorAll('[data-param]').forEach(input => {
            input.addEventListener('input', e => {
                this.paramValues[e.target.dataset.param] = e.target.value;
                this.saveContext();
                if (this.selectedCommand) this.renderBuilder();
            });
        });
    }

    esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    fillSelect(id, values, keepFirst) {
        const sel = document.getElementById(id);
        if (!sel) return;
        // keep the first option (the "All" entry), remove the rest
        while (sel.options.length > 1) sel.remove(1);
        [...values].sort((a, b) => a.localeCompare(b)).forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            sel.appendChild(opt);
        });
    }

    typeLabel(t) {
        const map = { command: 'Commands', script: 'Scripts', payload: 'Payloads', cheatsheet: 'Cheatsheets', resource: 'Resources', reference: 'Reference', 'attack-chain': 'Attack Chains' };
        return map[t] || (t.charAt(0).toUpperCase() + t.slice(1));
    }

    populateFilterOptions() {
        this.fillSelect('certFilter', this.certifications);
        const typeSel = document.getElementById('typeFilter');
        if (typeSel) {
            while (typeSel.options.length > 1) typeSel.remove(1);
            this.types.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t; opt.textContent = this.typeLabel(t);
                typeSel.appendChild(opt);
            });
        }
        const req = new Set(), proto = new Set(), tool = new Set();
        this.commands.forEach(cmd => {
            (cmd.requires || []).forEach(r => req.add(r));
            (cmd.protocols || []).forEach(p => proto.add(p));
            (cmd.tools || []).forEach(t => tool.add(t));
        });
        this.fillSelect('requiresFilter', req);
        this.fillSelect('protocolFilter', proto);
        this.fillSelect('toolFilter', tool);
    }

    buildCategoryTree() {
        // group() falls back to a no-op if groups.js is absent, so the tool still works flat.
        const grouped = (typeof categoryIsGrouped === 'function') ? categoryIsGrouped : () => false;
        const grpFor = (typeof groupFor === 'function') ? groupFor : () => null;
        const orderG = (typeof orderGroups === 'function') ? orderGroups : (c, g) => [...g].sort();
        const orderCats = (typeof orderCategories === 'function') ? orderCategories : (c) => [...c].sort();

        // build: category -> group -> Set(subcats)   (group === '' means flat/no-group)
        const tree = {};
        const counts = {};   // count[cat], count[cat|group], count[cat|group|sub]
        this.commands.forEach(cmd => {
            const cat = cmd.category || 'Other';
            const sub = cmd.subcategory || 'General';
            const grp = grouped(cat) ? (grpFor(cat, sub) || 'Other') : '';
            tree[cat] = tree[cat] || {};
            tree[cat][grp] = tree[cat][grp] || new Set();
            tree[cat][grp].add(sub);
            counts[cat] = (counts[cat] || 0) + 1;
            counts[cat + '|' + grp] = (counts[cat + '|' + grp] || 0) + 1;
            counts[cat + '|' + grp + '|' + sub] = (counts[cat + '|' + grp + '|' + sub] || 0) + 1;
        });

        const badge = n => '<span class="tree-count">' + n + '</span>';
        const subLink = (cat, sub) =>
            '<a class="tree-sub-item" data-cat="' + this.esc(cat) + '" data-sub="' + this.esc(sub) + '">' +
            this.esc(sub) + badge(counts[cat + '|' + (grouped(cat) ? (grpFor(cat, sub) || 'Other') : '') + '|' + sub]) + '</a>';

        // Determine which categories are blue-team (any card has CDSA cert)
        const blueCatSet = new Set();
        this.commands.forEach(cmd => {
            if ((cmd.certifications || []).includes('CDSA')) {
                blueCatSet.add(cmd.category || 'Other');
            }
        });

        const renderCat = cat => {
            let inner;
            if (grouped(cat)) {
                const groupNames = orderG(cat, Object.keys(tree[cat]));
                inner = groupNames.map(grp => {
                    const subs = [...tree[cat][grp]].sort().map(s => subLink(cat, s)).join('');
                    return '<div class="tree-group"><div class="tree-group-head" data-cat="' + this.esc(cat) + '" data-group="' + this.esc(grp) + '">' +
                        '<i class="fas fa-chevron-right chevron"></i>' + this.esc(grp) + badge(counts[cat + '|' + grp]) + '</div>' +
                        '<div class="tree-group-sub">' + subs + '</div></div>';
                }).join('');
            } else {
                inner = [...tree[cat]['']].sort().map(s => subLink(cat, s)).join('');
            }
            return '<div class="tree-cat"><div class="tree-cat-head" data-cat="' + this.esc(cat) + '">' +
                '<i class="fas fa-chevron-right chevron"></i>' + this.esc(cat) + badge(counts[cat]) + '</div>' +
                '<div class="tree-sub">' + inner + '</div></div>';
        };

        const allCats = orderCats(Object.keys(tree));
        const redCats  = allCats.filter(c => !blueCatSet.has(c));
        const blueCats = allCats.filter(c =>  blueCatSet.has(c));

        const el = document.getElementById('categoryTree');
        el.innerHTML =
            '<div class="tree-section-header tree-section-red"><span class="mode-pip red"></span> Red Team</div>' +
            redCats.map(renderCat).join('') +
            '<div class="tree-section-header tree-section-blue"><span class="mode-pip blue"></span> Blue Team</div>' +
            blueCats.map(renderCat).join('');

        const clearActive = () => el.querySelectorAll('.tree-sub-item.active, .tree-group-head.active').forEach(x => x.classList.remove('active'));

        // category header: expand/collapse only
        el.querySelectorAll('.tree-cat-head').forEach(h => {
            h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
        });
        // group header: expand/collapse AND filter to the whole group
        el.querySelectorAll('.tree-group-head').forEach(h => {
            h.addEventListener('click', () => {
                h.parentElement.classList.toggle('open');
                clearActive();
                h.classList.add('active');
                this.filters.category = h.dataset.cat;
                this.filters.group = h.dataset.group;
                delete this.filters.subcategory;
                document.getElementById('viewTitle').textContent = h.dataset.cat + ' › ' + h.dataset.group;
                this.renderCommands();
            });
        });
        // subcategory leaf: filter to that subcat
        el.querySelectorAll('.tree-sub-item').forEach(a => {
            a.addEventListener('click', () => {
                clearActive();
                a.classList.add('active');
                this.filters.category = a.dataset.cat;
                this.filters.subcategory = a.dataset.sub;
                delete this.filters.group;
                document.getElementById('viewTitle').textContent = a.dataset.sub;
                this.renderCommands();
            });
        });
    }

    /* ---------- filtering ---------- */
    // Parse the search box into field-scoped filters (tool:hydra, opsec:loud, mitre:T1003, ...)
    // plus free text. Field aliases map to card fields; unknown key:val is treated as text.
    parseSearch(raw) {
        const FIELD = {
            tool: 'tools', tools: 'tools', tag: 'tags', tags: 'tags', mitre: 'mitre',
            opsec: 'opsec', exam: 'exam', type: 'type', platform: 'platform', os: 'platform',
            cat: 'category', category: 'category', sub: 'subcategory', subcategory: 'subcategory',
            cert: 'certifications', access: 'requires', requires: 'requires', proto: 'protocols', protocol: 'protocols'
        };
        const filters = [];
        const words = [];
        for (const tok of String(raw || '').trim().split(/\s+/)) {
            if (!tok) continue;
            const m = tok.match(/^([a-z]+):(.+)$/i);
            if (m && FIELD[m[1].toLowerCase()]) filters.push({ field: FIELD[m[1].toLowerCase()], value: m[2].toLowerCase() });
            else words.push(tok.toLowerCase());
        }
        return { filters, text: words.join(' ').trim() };
    }

    // Relevance score for the free-text query against a card. 0 = no match.
    scoreCard(cmd, text) {
        if (!text) return 1;                                   // no text -> everything passes (score neutral)
        const name = (cmd.name || '').toLowerCase();
        const cmdStr = (cmd.command || '').toLowerCase();
        const desc = (cmd.description || '').toLowerCase();
        const tags = (cmd.tags || []).map(t => t.toLowerCase());
        const tools = (cmd.tools || []).map(t => t.toLowerCase());
        const mitre = (cmd.mitre || []).map(t => t.toLowerCase());
        let best = 0;
        const bump = v => { if (v > best) best = v; };
        if (name === text) bump(1000);
        if (name.startsWith(text)) bump(600);
        if (new RegExp('\\b' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) bump(400);
        if (name.includes(text)) bump(300);
        if (tools.some(t => t === text)) bump(250);
        if (tags.some(t => t === text)) bump(200);
        if (tools.some(t => t.includes(text)) || tags.some(t => t.includes(text))) bump(180);
        if (mitre.some(t => t.includes(text))) bump(160);
        if (cmdStr.includes(text)) bump(90);
        if (desc.includes(text)) bump(40);
        const myNote = (this.userNotes[cmd.id] || '').toLowerCase();
        if (myNote && myNote.includes(text)) bump(120);        // your own annotations are findable
        // light typo tolerance: subsequence match in name (e.g. "krbroast" -> "kerberoast")
        if (best === 0 && this.isSubsequence(text, name)) bump(15);
        return best;
    }

    isSubsequence(q, s) {
        if (q.length < 3) return false;
        let i = 0;
        for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
        return i === q.length;
    }

    getFilteredCommands() {
        const f = this.filters;
        const parsed = this.parseSearch(f.search);
        this._searchText = parsed.text;                        // used by cardHTML for highlighting
        const gf = (typeof groupFor === 'function') ? groupFor : () => null;

        const scored = [];
        for (const cmd of this.commands) {
            if (this.showFavoritesOnly && !this.favorites.has(cmd.id)) continue;
            if (this.showRecentOnly && !this.recent.includes(cmd.id)) continue;
            if (this.showCollection && !(this.collections[this.showCollection] || []).includes(cmd.id)) continue;
            // red/blue/both mode gate
            if (this.mode === 'red'  && this.isBlueCard(cmd)) continue;
            if (this.mode === 'blue' && !this.isBlueCard(cmd)) continue;
            // sidebar dropdown filters
            if (f.cert !== 'all' && !(cmd.certifications || []).includes(f.cert)) continue;
            if (f.type !== 'all' && (cmd.type || 'command') !== f.type) continue;
            if (f.platform !== 'all' && cmd.platform !== f.platform) continue;
            if (f.opsec !== 'all' && cmd.opsec !== f.opsec) continue;
            if (f.requires !== 'all' && !(cmd.requires || []).includes(f.requires)) continue;
            if (f.protocol !== 'all' && !(cmd.protocols || []).includes(f.protocol)) continue;
            if (f.tool !== 'all' && !(cmd.tools || []).includes(f.tool)) continue;
            if (f.category !== 'all' && cmd.category !== f.category) continue;
            if (f.subcategory && cmd.subcategory !== f.subcategory) continue;
            if (f.group && gf(cmd.category, cmd.subcategory) !== f.group) continue;
            // in-search field filters (tool:.., opsec:.., etc.)
            let ok = true;
            for (const flt of parsed.filters) {
                const v = cmd[flt.field];
                const hit = Array.isArray(v) ? v.some(x => String(x).toLowerCase().includes(flt.value))
                    : (v != null && String(v).toLowerCase().includes(flt.value));
                if (!hit) { ok = false; break; }
            }
            if (!ok) continue;
            // free-text relevance
            const score = this.scoreCard(cmd, parsed.text);
            if (score === 0) continue;
            scored.push({ cmd, score });
        }
        // ordering: Recent view -> by recency; else text search -> by score; else name order
        if (this.showRecentOnly && !parsed.text) {
            scored.sort((a, b) => this.recent.indexOf(a.cmd.id) - this.recent.indexOf(b.cmd.id));
        } else if (parsed.text) {
            scored.sort((a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name));
        }
        return scored.map(x => x.cmd);
    }

    resetFilters() {
        this.filters = Object.assign({}, this.defaultFilters);
        delete this.filters.subcategory;
        delete this.filters.group;
        this.showFavoritesOnly = false;
        this.showRecentOnly = false;
        this.showCollection = '';
        const cf = document.getElementById('collectionFilter'); if (cf) cf.value = '';
        document.getElementById('searchBox').value = '';
        ['certFilter', 'typeFilter', 'platformFilter', 'opsecFilter', 'requiresFilter', 'protocolFilter', 'toolFilter'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = 'all';
        });
        document.querySelectorAll('.tree-sub-item.active, .tree-group-head.active').forEach(a => a.classList.remove('active'));
        document.getElementById('favToggle').classList.remove('active');
        const rb = document.getElementById('recentToggle'); if (rb) rb.classList.remove('active');
        document.getElementById('viewTitle').textContent = 'All Commands';
        this.renderCommands();
    }

    // Dropdown filters that live inside the collapsible Filters panel.
    _panelFilterKeys() { return ['cert', 'type', 'platform', 'opsec', 'requires', 'protocol', 'tool']; }
    filterLabel(k) {
        return ({ cert: 'Cert', type: 'Type', platform: 'Platform', opsec: 'OpSec', requires: 'Access', protocol: 'Protocol', tool: 'Tool' })[k] || k;
    }

    // Badge on the top-bar Filters button = how many dropdown filters are active.
    updateFilterUI() {
        const f = this.filters;
        const active = this._panelFilterKeys().filter(k => f[k] && f[k] !== 'all');
        const badge = document.getElementById('filterCount');
        if (badge) {
            if (active.length) { badge.textContent = active.length; badge.hidden = false; }
            else { badge.hidden = true; }
        }
        const btn = document.getElementById('filterBtn');
        if (btn) btn.classList.toggle('has-filters', active.length > 0);
    }

    // Removable chips above the list showing every active filter (search, dropdowns, category, views).
    renderActiveChips() {
        const host = document.getElementById('activeChips');
        if (!host) return;
        const f = this.filters;
        const chips = [];
        if (f.search) chips.push({ key: 'search', label: 'search: ' + f.search });
        this._panelFilterKeys().forEach(k => { if (f[k] && f[k] !== 'all') chips.push({ key: k, label: this.filterLabel(k) + ': ' + f[k] }); });
        if (f.subcategory) chips.push({ key: 'category', label: f.subcategory });
        else if (f.group) chips.push({ key: 'category', label: f.group });
        else if (f.category && f.category !== 'all') chips.push({ key: 'category', label: f.category });
        if (this.showFavoritesOnly) chips.push({ key: 'fav', label: '★ Favorites' });
        if (this.showRecentOnly) chips.push({ key: 'recent', label: 'Recently Used' });
        if (this.showCollection) chips.push({ key: 'collection', label: 'Collection: ' + this.showCollection });
        if (!chips.length) { host.hidden = true; host.innerHTML = ''; return; }
        host.hidden = false;
        host.innerHTML = chips.map(c => '<span class="chip" data-chip="' + this.esc(c.key) + '">' + this.esc(c.label) +
            ' <button class="chip-x" title="Remove" aria-label="Remove">&times;</button></span>').join('') +
            (chips.length > 1 ? '<button class="chip-clear">Clear all</button>' : '');
        host.querySelectorAll('.chip .chip-x').forEach(x =>
            x.addEventListener('click', () => this.clearChip(x.parentElement.dataset.chip)));
        const clr = host.querySelector('.chip-clear');
        if (clr) clr.addEventListener('click', () => this.resetFilters());
    }

    clearChip(key) {
        const f = this.filters;
        if (key === 'search') { f.search = ''; const s = document.getElementById('searchBox'); if (s) s.value = ''; }
        else if (this._panelFilterKeys().includes(key)) { f[key] = 'all'; const el = document.getElementById(key + 'Filter'); if (el) el.value = 'all'; }
        else if (key === 'category') {
            f.category = 'all'; delete f.subcategory; delete f.group;
            document.querySelectorAll('.tree-sub-item.active, .tree-group-head.active').forEach(a => a.classList.remove('active'));
            document.getElementById('viewTitle').textContent = 'All Commands';
        }
        else if (key === 'fav') { this.showFavoritesOnly = false; document.getElementById('favToggle').classList.remove('active'); }
        else if (key === 'recent') { this.showRecentOnly = false; const r = document.getElementById('recentToggle'); if (r) r.classList.remove('active'); }
        else if (key === 'collection') { this.showCollection = ''; const c = document.getElementById('collectionFilter'); if (c) c.value = ''; }
        this.renderCommands();
    }

    // Deselect the current command (used by the mobile close button on the builder sheet).
    clearSelection() {
        this.selectedCommand = null;
        const app = document.getElementById('app'); if (app) app.classList.remove('has-selection');
        document.querySelectorAll('.command-card.selected').forEach(el => el.classList.remove('selected'));
        this.renderBuilder();
    }

    /* ---------- command list ---------- */
    // Escape HTML, then wrap the current free-text search term in <mark> (case-insensitive).
    hl(text) {
        const safe = this.esc(text);
        const q = this._searchText;
        if (!q) return safe;
        const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return safe.replace(re, '<mark>$1</mark>');
    }

    reqBadgeClass(r) {
        const key = r.toLowerCase();
        if (['password', 'hash', 'ticket', 'no-creds', 'network-access'].includes(key)) return key;
        if (['smb', 'ldap', 'kerberos', 'winrm', 'tcp', 'udp', 'http', 'smtp'].includes(key)) return 'protocol';
        return '';
    }

    cardHTML(cmd) {
        const reqs = [...(cmd.requires || []), ...(cmd.protocols || [])];
        const reqBadges = reqs.map(r =>
            '<span class="req-badge ' + this.reqBadgeClass(r) + '">' + this.esc(r) + '</span>').join('');
        const tags = (cmd.tags || []).map(t => '<span class="tag">' + this.esc(t) + '</span>').join('');
        const recCount = (cmd.recommended || []).length + (cmd.references || []).length;
        const countBadge = recCount ? '<span class="count-badge">' + recCount + '</span>' : '';
        const fav = this.favorites.has(cmd.id) ? 'on' : '';
        const starIcon = this.favorites.has(cmd.id) ? 'fas' : 'far';
        const sel = this.selectedCommand && this.selectedCommand.id === cmd.id ? ' selected' : '';
        const type = cmd.type || 'command';
        const typeBadge = type !== 'command' ? '<span class="type-badge type-' + this.esc(type) + '">' + this.esc(type) + '</span>' : '';
        const opsecBadge = cmd.opsec ? '<span class="opsec-dot opsec-' + this.esc(cmd.opsec) + '" title="OpSec: ' + this.esc(cmd.opsec) + '"></span>' : '';
        const teamColor = this.isBlueCard(cmd) ? 'blue' : 'red';
        const teamLabel = this.isBlueCard(cmd) ? 'Blue Team (CDSA)' : 'Red Team';
        const teamDot = '<span class="team-dot ' + teamColor + '" title="' + teamLabel + '"></span>';
        const examBadge = cmd.exam ? '<span class="exam-badge exam-' + this.esc(cmd.exam) + '" title="OSCP exam: ' + this.esc(cmd.exam) + '">' + this.esc(cmd.exam) + '</span>' : '';
        const noteDot = this.getUserNote(cmd.id) ? '<span class="note-dot" title="You have notes">&#9998;</span>' : '';
        const collDot = this.cardInAnyCollection(cmd.id) ? '<span class="coll-dot" title="In a collection"><i class="fas fa-bookmark"></i></span>' : '';
        return '<div class="command-card type-border-' + this.esc(type) + sel + '" data-id="' + this.esc(cmd.id) + '">' +
            '<div class="card-header"><div class="card-title">' + teamDot + '<h3>' + this.hl(cmd.name) + '</h3>' + opsecBadge + examBadge + typeBadge + countBadge + noteDot + collDot + '</div>' +
            '<i class="' + starIcon + ' fa-star fav-star ' + fav + '" data-fav="' + this.esc(cmd.id) + '"></i></div>' +
            '<div class="card-cmd">' + this.hl(cmd.command) + '</div>' +
            '<div class="req-badges">' + reqBadges + '</div>' +
            '<div class="tags">' + tags + '</div>' +
            '</div>';
    }

    // Windowed rendering: only a batch of cards is in the DOM at once, more load on scroll.
    // Keeps the list snappy whether there are 600 cards or 6000. Card clicks use event
    // delegation (bound once in bindEvents), so appended cards need no re-wiring.
    renderCommands() {
        this.filtered = this.getFilteredCommands();
        this.updateFilterUI();
        this.renderActiveChips();
        this.renderCount = 0;
        this.focusIndex = -1;
        const c = document.getElementById('commandList');
        if (this.filtered.length === 0) {
            c.innerHTML = '<p class="no-results">No commands match your filters.</p>';
            return;
        }
        c.innerHTML = '<div id="cardBatch"></div><div id="scrollSentinel"></div>';
        this.renderMore();
        this.observeSentinel();
    }

    renderMore() {
        const BATCH = 60;
        const batchEl = document.getElementById('cardBatch');
        if (!batchEl || this.renderCount >= this.filtered.length) return;
        const next = this.filtered.slice(this.renderCount, this.renderCount + BATCH);
        batchEl.insertAdjacentHTML('beforeend', next.map(cmd => this.cardHTML(cmd)).join(''));
        this.renderCount += next.length;
    }

    // Keyboard navigation: move a "focused" highlight through the filtered list, loading
    // more of the windowed list as needed, and open the focused card on Enter.
    focusMove(delta) {
        if (!this.filtered || !this.filtered.length) return;
        let i = this.focusIndex + delta;
        if (i < 0) i = 0;
        if (i >= this.filtered.length) i = this.filtered.length - 1;
        this.focusIndex = i;
        while (this.renderCount <= i && this.renderCount < this.filtered.length) this.renderMore();
        const cards = document.querySelectorAll('#commandList .command-card');
        cards.forEach(c => c.classList.remove('focused'));
        const el = cards[i];
        if (el) { el.classList.add('focused'); el.scrollIntoView({ block: 'nearest' }); }
    }
    focusOpen() {
        if (this.focusIndex >= 0 && this.filtered[this.focusIndex]) {
            this.selectCommand(this.filtered[this.focusIndex]);
        }
    }

    observeSentinel() {
        if (this._io) this._io.disconnect();
        const sentinel = document.getElementById('scrollSentinel');
        if (!sentinel) return;
        this._io = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) this.renderMore();
        }, { root: document.getElementById('commandList'), rootMargin: '400px' });
        this._io.observe(sentinel);
    }

    toggleFavorite(id) {
        const wasFav = this.favorites.has(id);
        if (wasFav) this.favorites.delete(id);
        else this.favorites.add(id);
        this.saveFavorites();
        // In favorites-only view the list membership changes, so re-render.
        // Otherwise just flip the star in place - no full re-render, no scroll jump.
        if (this.showFavoritesOnly) { this.renderCommands(); return; }
        const star = document.querySelector('.fav-star[data-fav="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        if (star) {
            star.classList.toggle('on', !wasFav);
            star.classList.toggle('fas', !wasFav);
            star.classList.toggle('far', wasFav);
        }
    }

    /* ---------- builder ---------- */
    selectCommand(cmd) {
        this.selectedCommand = cmd;
        this.authTab = 0;
        const isBlue = Array.isArray(cmd.certifications) && cmd.certifications.some(c => c.toUpperCase() === 'CDSA');
        this.builderTab = isBlue ? 'defend' : 'attack';
        this.pushRecent(cmd.id);
        const app = document.getElementById('app'); if (app) app.classList.add('has-selection');
        this.renderBuilder();
        // on narrow layouts the builder is stacked/overlaid - bring it into view
        if (window.innerWidth <= 1100) {
            const b = document.getElementById('builder');
            if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // move the "selected" highlight in place - no full re-render, preserves scroll/window
        const list = document.getElementById('commandList');
        if (list) {
            list.querySelectorAll('.command-card.selected').forEach(el => el.classList.remove('selected'));
            const card = list.querySelector('.command-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(cmd.id) : cmd.id) + '"]');
            if (card) card.classList.add('selected');
        }
    }

    activeCommandString() {
        const cmd = this.selectedCommand;
        if (!cmd) return '';
        const vars = cmd.variations || [];
        if (this.authTab > 0 && vars[this.authTab - 1]) return vars[this.authTab - 1].command;
        return cmd.command;
    }

    placeholdersIn(str) {
        return [...new Set([...str.matchAll(/<([a-zA-Z0-9_-]+)>/g)].map(m => m[1]))];
    }

    // Alias-aware substitution: a token like <target> or <host> is filled by whatever the
    // user typed for its CANONICAL variable (ip), so one field fills every spelling.
    substitute(str) {
        const canon = (typeof canonVar === 'function') ? canonVar : (() => null);
        return str.replace(/<([a-zA-Z0-9_\-]+)>/g, (whole, token) => {
            // 1) exact match on what the user typed (covers per-command local params)
            if (this.paramValues[token]) return this.paramValues[token];
            // 2) canonical engagement var (fills <target>/<host>/... from the `ip` field)
            const key = canon(token);
            if (key && this.paramValues[key]) return this.paramValues[key];
            return whole;
        });
    }

    renderBuilder() {
        const cmd = this.selectedCommand;
        const body = document.getElementById('builderBody');
        if (!cmd) {
            body.innerHTML = '<div class="builder-empty onboard">' +
                '<p class="ob-lead">Build a ready-to-run command in three steps:</p>' +
                '<ol class="ob-steps">' +
                '<li><b>Set your target once</b> - fill IP, user, LHOST… in the <span class="ob-hl">TARGET</span> bar up top. It fills every command (and aliases like <code>&lt;target&gt;</code>, <code>&lt;rhost&gt;</code>).</li>' +
                '<li><b>Find a command</b> - search (Ctrl+K) or pick a Category on the left.</li>' +
                '<li><b>Copy</b> - it appears here filled in, with anything still missing flagged.</li>' +
                '</ol></div>';
            const app = document.getElementById('app'); if (app) app.classList.remove('has-selection');
            return;
        }

        const active = this.activeCommandString();
        const params = this.placeholdersIn(active);

        const vars = cmd.variations || [];
        // Unlabeled variations fall back to a compact preview of their own command (not "Variant"),
        // and the CSS truncates long labels to one line - full text is in the title tooltip.
        const varLabel = v => v.label || String(v.command || '').replace(/\s+/g, ' ').trim() || 'Variant';
        const tabDefs = [{ label: 'Default', title: 'Default\n' + cmd.command }].concat(
            vars.map(v => ({ label: varLabel(v), title: (v.label ? v.label + '\n' : '') + (v.command || '') })));
        const tabs = vars.length ? '<div class="auth-tabs">' + tabDefs.map((t, i) =>
            '<div class="auth-tab' + (this.authTab === i ? ' active' : '') + '" title="' + this.esc(t.title) + '" data-tab="' + i + '">' + this.esc(t.label) + '</div>'
        ).join('') + '</div>' : '';

        // Resolve each placeholder to its canonical engagement var (so <target> edits the
        // same `ip` value as the global bar). De-dupe when several tokens map to one key.
        const canon = (typeof canonVar === 'function') ? canonVar : (() => null);
        const varByKey = (typeof VAR_BY_KEY !== 'undefined') ? VAR_BY_KEY : {};
        const seen = new Set();
        const paramList = [];
        params.forEach(tok => {
            const key = canon(tok) || tok;
            if (seen.has(key)) return;
            seen.add(key);
            const label = varByKey[key] ? varByKey[key].label : (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
            paramList.push({ key, label });
        });
        const paramFields = paramList.length ? paramList.map(p => {
            const v = this.paramValues[p.key] || '';
            return '<div class="param-field"><label>' + this.esc(p.label) + '</label>' +
                '<input type="text" data-bparam="' + this.esc(p.key) + '" placeholder="Enter ' + this.esc(p.label.toLowerCase()) + '..." value="' + this.esc(v) + '"></div>';
        }).join('') : '<p style="color:var(--muted);font-size:.82rem">No parameters for this command.</p>';

        // Recommended: title/description looked up LIVE from the target card (no stale copies);
        // grouped by relationship; rec.note carries the chain-specific "why".
        const REL_LABEL = { next: 'Next steps', alternative: 'Alternatives', prereq: 'Prerequisites', escalation: 'Escalation', cleanup: 'Cleanup' };
        const REL_ORDER = ['prereq', 'next', 'escalation', 'alternative', 'cleanup'];
        const recItem = (targetId, note, rel) => {
            const t = this.byId[targetId];
            if (!t) return '';
            const title = this.esc(t.name);
            const why = note ? '<p>' + this.esc(note) + '</p>' : (t.description ? '<p class="rec-desc">' + this.esc(t.description) + '</p>' : '');
            const relBadge = rel && rel !== 'next' ? '<span class="rel-badge rel-' + this.esc(rel) + '">' + this.esc(rel) + '</span>' : '';
            return '<div class="rec-item" data-recid="' + this.esc(targetId) + '">' +
                '<div><h4>' + title + relBadge + '</h4>' + why + '</div>' +
                '<i class="fas fa-arrow-right arrow"></i></div>';
        };
        const rec = (cmd.recommended || []).filter(r => r && r.id && this.byId[r.id]);
        let recHtml = '';
        if (rec.length) {
            const groups = {};
            rec.forEach(r => (groups[r.rel || 'next'] = groups[r.rel || 'next'] || []).push(r));
            const body = REL_ORDER.filter(g => groups[g]).map(g =>
                '<div class="rec-group-label">' + this.esc(REL_LABEL[g] || g) + '</div>' +
                groups[g].map(r => recItem(r.id, r.note, r.rel)).join('')
            ).join('');
            recHtml = '<details class="rec-box b-collapse" open><summary class="box-title"><i class="fas fa-link"></i> Recommended Next Commands</summary>' + body + '</details>';
        }

        // Reverse chain: which cards lead HERE (auto-computed, not stored).
        const back = (this.reverseRec[cmd.id] || []).filter(r => this.byId[r.id]);
        const backHtml = back.length ? '<details class="rec-box back-box b-collapse"><summary class="box-title"><i class="fas fa-arrow-left"></i> Reached From</summary>' +
            back.map(r => {
                const t = this.byId[r.id];
                return '<div class="rec-item" data-recid="' + this.esc(r.id) + '"><div><h4>' + this.esc(t.name) + '</h4>' +
                    (r.note ? '<p>' + this.esc(r.note) + '</p>' : '') + '</div><i class="fas fa-arrow-right arrow"></i></div>';
            }).join('') + '</details>' : '';

        const refs = (cmd.references || []);
        const refHtml = refs.length ? '<details class="ref-box b-collapse"><summary class="box-title"><i class="fas fa-book"></i> References and Documentation</summary>' +
            refs.map(r => '<a class="ref-link" href="' + this.esc(r.url) + '" target="_blank" rel="noopener">' +
                this.esc(r.title) + '<i class="fas fa-external-link-alt"></i></a>').join('') + '</details>' : '';

        // Steps are substituted with the live target context (like the generated command), so a
        // multi-step chain is copy-ready. "Copy all" grabs the whole substituted sequence.
        const steps = (cmd.steps || []);
        const allSteps = steps.map(s => this.substitute(s.command)).join('\n');
        const stepsHtml = steps.length ? '<div class="steps-box"><div class="box-title"><i class="fas fa-list-ol"></i> Attack Chain' +
            '<button class="copy-all-btn" data-copyall="' + this.esc(allSteps) + '"><i class="fas fa-copy"></i> Copy all</button>' +
            '<button class="copy-script-btn" title="Copy these steps as a runnable script with your target filled in"><i class="fas fa-file-export"></i> Script</button></div>' +
            steps.map((s, i) => {
                const sc = this.substitute(s.command);
                return '<div class="step-item">' +
                    '<div class="step-head"><span class="step-num">' + (i + 1) + '</span>' +
                    '<span class="step-label">' + this.esc(s.label || ('Step ' + (i + 1))) + '</span>' +
                    '<button class="copy-btn mini" data-copy="' + this.esc(sc) + '"><i class="fas fa-copy"></i></button></div>' +
                    '<pre class="step-cmd">' + this.esc(sc) + '</pre></div>';
            }).join('') + '</div>' : '';

        const examples = (cmd.examples || []);
        const exHtml = examples.length ? '<details class="ex-box b-collapse"><summary class="box-title"><i class="fas fa-terminal"></i> Examples</summary>' +
            examples.map(x => {
                const label = (typeof x === 'object' && x) ? (x.label || '') : '';
                const command = (typeof x === 'object' && x) ? (x.command || '') : x;
                const cap = label ? '<div class="ex-label">' + this.esc(label) + '</div>' : '';
                return '<div class="ex-item-wrap">' + cap +
                    '<div class="ex-item"><pre class="ex-cmd">' + this.esc(command) + '</pre>' +
                    '<button class="copy-btn mini" data-copy="' + this.esc(command) + '"><i class="fas fa-copy"></i></button></div></div>';
            }).join('') + '</details>' : '';

        const notes = cmd.notes ? '<div class="notes">' + this.esc(cmd.notes) + '</div>' : '';
        const myNote = this.getUserNote(cmd.id);
        const myNotesHtml = '<div class="mynotes-box"><div class="box-title"><i class="fas fa-pen"></i> My Notes</div>' +
            '<textarea id="myNoteInput" class="mynote-input" placeholder="Your own notes on this command - gotchas, lab tweaks, what worked / failed...">' + this.esc(myNote) + '</textarea></div>';
        const platIcon = cmd.platform === 'windows' ? 'fab fa-windows' : (cmd.platform === 'multi' ? 'fas fa-laptop-code' : 'fab fa-linux');

        const opsecPill = cmd.opsec ?
            '<span class="opsec-pill opsec-' + this.esc(cmd.opsec) + '"><i class="fas fa-signal"></i> ' + this.esc(cmd.opsec) + '</span>' : '';
        const examPill = cmd.exam ?
            '<span class="exam-pill exam-' + this.esc(cmd.exam) + '"><i class="fas fa-graduation-cap"></i> ' + this.esc(cmd.exam) + '</span>' : '';
        const mitre = (cmd.mitre || []);
        const mitreHtml = mitre.length ? '<div class="mitre-row">' +
            mitre.map(t => {
                const base = String(t).split('.')[0];
                const url = 'https://attack.mitre.org/techniques/' + (String(t).includes('.') ? base + '/' + String(t).split('.')[1] : base) + '/';
                return '<a class="mitre-chip" href="' + this.esc(url) + '" target="_blank" rel="noopener" title="MITRE ATT&CK ' + this.esc(t) + '">' + this.esc(t) + '</a>';
            }).join('') + '</div>' : '';

        // ── Blue vs Red card detection ─────────────────────────────────────
        const isBlueCard = Array.isArray(cmd.certifications) && cmd.certifications.some(c => c.toUpperCase() === 'CDSA');

        // ── Defense / Understand / Notes tab content ──────────────────────
        const def = cmd.defense || {};

        // Plain text section (pre-wrap)
        const defSection = (title, cssClass, text) => {
            if (!text) return '';
            return '<div class="def-section"><div class="def-section-title ' + cssClass + '">' + title + '</div>' +
                '<div class="def-text">' + this.esc(text) + '</div></div>';
        };

        // Code block section — renders monospaced with diff colouring
        const defCode = (title, cssClass, blockClass, code) => {
            if (!code) return '';
            return '<div class="def-section"><div class="def-section-title ' + cssClass + '">' + title + '</div>' +
                '<div class="def-code-wrap"><pre class="def-code-block ' + blockClass + '">' + this.esc(code) + '</pre></div></div>';
        };

        // Understand tab: prerequisites → why it works → misconfiguration → impact
        const understandTitle = isBlueCard
            ? '🎯 Attack Technique — What the Adversary Did'
            : '💡 Why This Works — Root Cause';
        const understandEmpty = isBlueCard
            ? 'Attack technique context not yet added.<br>Populate <code>defense.why_it_works</code> with the adversary methodology + root cause.'
            : 'Root-cause analysis not yet added for this technique.<br>Run the HTB module cross-check pass to populate this.';
        const hasUnderstand = def.why_it_works || def.prerequisites || def.impact || def.misconfiguration;
        const understandHtml =
            (hasUnderstand
                ? defSection('🔑 Prerequisites — What Must Be True First', 'dt-prereq', def.prerequisites) +
                  defSection(understandTitle, 'dt-why', def.why_it_works) +
                  defSection('⚠️ The Misconfiguration / Vulnerable Pattern', 'dt-misconfig', def.misconfiguration) +
                  defCode('🔎 Spot It in Code Review (grep / red flags)', 'dt-misconfig', 'coderev', def.code_review) +
                  defSection('🎯 Impact — What Success Grants', 'dt-impact', def.impact)
                : '<div class="def-empty">' + understandEmpty + '</div>') +
            myNotesHtml;

        // Defend tab: detection → artifacts → vulnerable code → secure code → prevention → evasion
        const defendEmpty = isBlueCard
            ? 'Detection rules, event IDs, and prevention not yet added.<br>Populate <code>defense.detection / prevention / evasion</code> fields.'
            : 'Defense analysis not yet added for this technique.<br>Run the HTB module cross-check pass to populate this.';
        const sourcesHtml = (Array.isArray(def.sources) && def.sources.length)
            ? '<div class="def-sources">Sources: ' + def.sources.map(s => '<span class="def-source-chip">' + this.esc(s) + '</span>').join(' ') + '</div>'
            : '';
        const defendHtml =
            (def.detection || def.prevention || def.evasion || def.artifacts || def.vulnerable_config || def.secure_config
                ? defSection('🔍 Detection', 'dt-detect', def.detection) +
                  defSection('🧾 Artifacts / Forensic Evidence', 'dt-artifacts', def.artifacts) +
                  defCode('❌ Vulnerable Configuration / Code', 'dt-vuln-code', 'vuln', def.vulnerable_config) +
                  defCode('✅ Secure Configuration / Code', 'dt-secure-code', 'secure', def.secure_config) +
                  defSection('🛡 Prevention / Remediation', 'dt-prevent', def.prevention) +
                  defSection('👻 Evasion (how attackers avoid the above)', 'dt-evasion', def.evasion) +
                  sourcesHtml
                : '<div class="def-empty">' + defendEmpty + '</div>') +
            myNotesHtml;

        // Notes tab — renders cmd.notes, parsing === SECTION === headers into styled headings
        const rawNotes = (cmd.notes || '').trim();
        const notesTabHtml = rawNotes
            ? '<div class="notes-tab-content">' +
              rawNotes.split('\n').map(line => {
                  const hdr = line.match(/^={2,}\s*(.+?)\s*={2,}$/);
                  if (hdr) return '<div class="notes-section-head">' + this.esc(hdr[1]) + '</div>';
                  return '<span class="notes-body">' + this.esc(line) + '\n</span>';
              }).join('') +
              '</div>'
            : '<div class="def-empty">No study notes added yet for this command.<br>Add context, chains, and methodology to the <code>notes</code> field.</div>';

        // Attack/Investigate tab: same content, label changes for blue cards
        const investigateHtml =
            tabs +
            '<div class="gen-box"><div class="gen-box-head"><span>Generated Command</span>' +
                '<div class="gen-actions"><button class="copy-btn ghost" id="sendFinding" title="Add to Exam Mode findings"><i class="fas fa-flag"></i> Findings</button>' +
                '<button class="copy-btn ghost" id="genCopyRaw" title="Copy raw template (with &lt;placeholders&gt;)">&lt;/&gt;</button>' +
                '<button class="copy-btn" id="genCopy"><i class="fas fa-copy"></i> Copy</button></div></div>' +
                '<div id="genCmd"></div><div id="unfilledHint" class="unfilled-hint"></div></div>' +
            '<div class="b-section-label"><i class="fas fa-sliders-h"></i> Parameters</div>' +
            '<div class="b-params">' + paramFields + '</div>' +
            stepsHtml + recHtml + exHtml + backHtml + refHtml + myNotesHtml;

        // ── Perspective tabs ───────────────────────────────────────────────
        const btabs = ['attack','understand','defend','notes'];
        const btabLabels = isBlueCard
            ? { attack: '🔍 Investigate', understand: '🎯 Understand Attack', defend: '🛡 Defend', notes: '📓 Notes' }
            : { attack: '⚔ Attack',       understand: '💡 Understand',        defend: '🛡 Defend', notes: '📓 Notes' };
        const btabsHtml = '<div class="builder-tabs">' +
            btabs.map(t => '<button class="builder-tab' + (this.builderTab === t ? ' active' : '') +
                '" data-btab="' + t + '">' + btabLabels[t] + '</button>').join('') + '</div>';

        const tabContent = this.builderTab === 'understand' ? understandHtml
                         : this.builderTab === 'defend'     ? defendHtml
                         : this.builderTab === 'notes'      ? notesTabHtml
                         :                                    investigateHtml;

        // Attack-path strip: what leads HERE -> THIS -> what's next. Offline, clickable, no deps.
        const chChip = (id, cls) => { const t = this.byId[id]; return t ? '<button class="chain-chip ' + cls + '" data-recid="' + this.esc(id) + '" title="' + this.esc(t.name) + '">' + this.esc(t.name) + '</button>' : ''; };
        const leftIds = [...new Set(back.map(r => r.id))].filter(i => this.byId[i]).slice(0, 3);
        const nextIds = [...new Set(rec.filter(r => r.rel === 'next' || r.rel === 'escalation').map(r => r.id))].filter(i => this.byId[i]).slice(0, 4);
        let chainStrip = '';
        if (leftIds.length || nextIds.length) {
            chainStrip = '<div class="chain-strip">' +
                (leftIds.length ? leftIds.map(i => chChip(i, 'chain-prev')).join('') + '<span class="chain-arrow">&rsaquo;</span>' : '') +
                '<span class="chain-here" title="You are here">' + this.esc(cmd.name) + '</span>' +
                (nextIds.length ? '<span class="chain-arrow">&rsaquo;</span>' + nextIds.map(i => chChip(i, 'chain-next')).join('') : '') +
                '</div>';
        }

        body.innerHTML =
            '<div class="b-title"><h3>' + this.esc(cmd.name) + '</h3>' +
                '<span class="platform-pill"><i class="' + platIcon + '"></i> ' + this.esc(cmd.platform) + '</span>' + opsecPill + examPill +
                '<div class="coll-wrap"><button id="collBtn" class="coll-btn" title="Add to a collection"><i class="fas fa-bookmark"></i></button>' +
                '<div id="collPop" class="coll-pop" hidden></div></div>' +
                '<button id="bClose" class="b-close" title="Close" aria-label="Close">&times;</button></div>' +
            '<p class="b-desc">' + this.esc(cmd.description) + '</p>' +
            mitreHtml +
            chainStrip +
            btabsHtml +
            tabContent;

        // wire perspective tabs (Attack / Understand / Defend)
        body.querySelectorAll('.builder-tab').forEach(t => {
            t.addEventListener('click', () => { this.builderTab = t.dataset.btab; this.renderBuilder(); });
        });
        // wire variation tabs
        body.querySelectorAll('.auth-tab').forEach(t => {
            t.addEventListener('click', () => { this.authTab = parseInt(t.dataset.tab, 10); this.renderBuilder(); });
        });
        // wire params
        body.querySelectorAll('[data-bparam]').forEach(input => {
            input.addEventListener('input', e => {
                this.paramValues[e.target.dataset.bparam] = e.target.value;
                this.saveContext();
                this.syncContextInputs();
                this.updateGenerated();
            });
        });
        // wire recommended + attack-path chain chips
        body.querySelectorAll('.rec-item, .chain-chip').forEach(item => {
            const id = item.dataset.recid;
            if (!id) return;
            item.addEventListener('click', () => {
                const target = this.commands.find(x => x.id === id);
                if (target) {
                    this.selectCommand(target);
                    document.getElementById('commandList').scrollTop = 0;
                }
            });
        });
        // copy (only present in Attack tab)
        const genCopyBtn = document.getElementById('genCopy');
        if (genCopyBtn) genCopyBtn.addEventListener('click', () => {
            this.copyText(document.getElementById('genCmd').textContent);
        });
        const genCopyRawBtn = document.getElementById('genCopyRaw');
        if (genCopyRawBtn) genCopyRawBtn.addEventListener('click', () => {
            this.copyText(this.activeCommandString());   // raw template with <placeholders>
        });
        const sf = document.getElementById('sendFinding');
        if (sf) sf.addEventListener('click', () => this.sendToFindings(cmd));
        const bClose = document.getElementById('bClose');
        if (bClose) bClose.addEventListener('click', () => this.clearSelection());
        // click an "Unfilled: X" chip -> focus that parameter (or the target-bar field)
        const genBox = body.querySelector('.gen-box');
        if (genBox) genBox.addEventListener('click', e => {
            const chip = e.target.closest('.unfilled-chip');
            if (!chip) return;
            const key = chip.dataset.focus;
            const sel = (window.CSS && CSS.escape) ? CSS.escape(key) : key;
            const inp = body.querySelector('[data-bparam="' + sel + '"]') ||
                        document.querySelector('#tcFields [data-param="' + sel + '"]');
            if (inp) { inp.focus(); if (inp.scrollIntoView) inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        });
        // collections popover
        const collBtn = document.getElementById('collBtn');
        const collPop = document.getElementById('collPop');
        if (collBtn && collPop) {
            collBtn.classList.toggle('active', this.cardInAnyCollection(cmd.id));
            collBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (collPop.hidden) { this.renderCollPop(cmd); collPop.hidden = false; }
                else collPop.hidden = true;
            });
            document.addEventListener('click', e => { if (!collPop.contains(e.target) && e.target !== collBtn && !collBtn.contains(e.target)) collPop.hidden = true; });
        }
        // mini copy buttons (steps / examples)
        body.querySelectorAll('.copy-btn.mini').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.copyText(btn.dataset.copy);
            });
        });
        // copy-all (whole attack chain)
        const copyAll = body.querySelector('.copy-all-btn');
        if (copyAll) copyAll.addEventListener('click', e => { e.stopPropagation(); this.copyText(copyAll.dataset.copyall); });
        const copyScript = body.querySelector('.copy-script-btn');
        if (copyScript) copyScript.addEventListener('click', e => { e.stopPropagation(); this.copyAsScript(); });
        // personal note: debounced save + live card indicator
        const noteEl = document.getElementById('myNoteInput');
        if (noteEl) noteEl.addEventListener('input', e => {
            clearTimeout(this._noteDebounce);
            const id = cmd.id, val = e.target.value;
            this._noteDebounce = setTimeout(() => {
                const had = !!this.getUserNote(id);
                this.setUserNote(id, val);
                const nowHas = !!this.getUserNote(id);
                if (had !== nowHas) {   // toggle the card-list indicator without a full re-render
                    const card = document.querySelector('.command-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"] .card-title');
                    if (card) {
                        const ex = card.querySelector('.note-dot');
                        if (nowHas && !ex) card.insertAdjacentHTML('beforeend', '<span class="note-dot" title="You have notes">&#9998;</span>');
                        if (!nowHas && ex) ex.remove();
                    }
                }
            }, 300);
        });

        this.updateGenerated();
    }

    updateGenerated() {
        const el = document.getElementById('genCmd');
        if (!el) return;
        const active = this.activeCommandString();
        el.textContent = this.substitute(active);
        // show which placeholders are still unfilled (so you know what to set)
        const hint = document.getElementById('unfilledHint');
        if (hint) {
            const canon = (typeof canonVar === 'function') ? canonVar : (() => null);
            const varByKey = (typeof VAR_BY_KEY !== 'undefined') ? VAR_BY_KEY : {};
            const keys = [...new Set(this.placeholdersIn(active).map(t => canon(t) || t))];
            const unfilled = keys.filter(k => !this.paramValues[k]);
            if (unfilled.length) {
                hint.innerHTML = '<i class="fas fa-circle-exclamation"></i> Unfilled: ' +
                    unfilled.map(k => '<button class="unfilled-chip" data-focus="' + this.esc(k) + '">' +
                        this.esc(varByKey[k] ? varByKey[k].label : k) + '</button>').join('');
                hint.style.display = '';
            } else { hint.style.display = 'none'; }
        }
        // keep substituted steps in sync when params change (they're card-level, not variation)
        const stepsBox = document.querySelector('.steps-box');
        if (stepsBox && this.selectedCommand) {
            const steps = this.selectedCommand.steps || [];
            const pres = stepsBox.querySelectorAll('.step-cmd');
            const btns = stepsBox.querySelectorAll('.step-item .copy-btn.mini');
            steps.forEach((s, i) => { const sc = this.substitute(s.command); if (pres[i]) pres[i].textContent = sc; if (btns[i]) btns[i].dataset.copy = sc; });
            const ca = stepsBox.querySelector('.copy-all-btn');
            if (ca) ca.dataset.copyall = steps.map(s => this.substitute(s.command)).join('\n');
        }
    }

    /* ---------- shared context ---------- */
    // Push paramValues back onto whatever context-bar inputs are currently visible.
    // (Non-visible vars still live in paramValues, so nothing is lost.)
    syncContextInputs() {
        document.querySelectorAll('#targetContext [data-param]').forEach(input => {
            const p = input.dataset.param;
            input.value = this.paramValues[p] || '';
        });
    }

    copyText(text) {
        navigator.clipboard.writeText(text).then(() => this.toast('Copied')).catch(() => this.toast('Copy failed'));
    }
    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 1400);
    }

    /* ---------- markdown export (current filtered view -> printable cheatsheet) ---------- */
    exportMarkdown() {
        const cards = this.getFilteredCommands();
        if (!cards.length) { this.toast('Nothing to export in this view'); return; }
        const sub = s => this.substitute(String(s || ''));
        const title = document.getElementById('viewTitle').textContent || 'Command Reference';
        const out = [];
        out.push('# ' + title + ' — Command Reference');
        out.push('', `_${cards.length} commands · exported ${new Date().toISOString().slice(0, 10)}_`, '');
        // group by category -> subcategory
        const groups = {};
        cards.forEach(c => {
            const cat = c.category || 'Other', s = c.subcategory || '';
            ((groups[cat] = groups[cat] || {})[s] = (groups[cat][s] || [])).push(c);
        });
        for (const cat of Object.keys(groups).sort()) {
            out.push('', '## ' + cat, '');
            for (const s of Object.keys(groups[cat]).sort()) {
                if (s) out.push('### ' + s, '');
                for (const c of groups[cat][s]) {
                    out.push('#### ' + c.name + (c.opsec ? `  \`${c.opsec}\`` : ''));
                    if (c.description) out.push('', c.description);
                    out.push('', '```', sub(c.command), '```');
                    (c.variations || []).forEach(v => out.push('', `- **${v.label || 'Variant'}**`, '  ```', '  ' + sub(v.command).replace(/\n/g, '\n  '), '  ```'));
                    if ((c.steps || []).length) {
                        out.push('', '**Steps:**');
                        c.steps.forEach((st, i) => out.push(`${i + 1}. ${st.label || ''}`, '   ```', '   ' + sub(st.command).replace(/\n/g, '\n   '), '   ```'));
                    }
                    (c.examples || []).forEach(x => { const cmd = typeof x === 'object' ? x.command : x; const lb = typeof x === 'object' ? x.label : ''; out.push('', `_${lb || 'Example'}_`, '```', cmd, '```'); });
                    if (c.notes) out.push('', '> ' + String(c.notes).replace(/\n/g, '\n> '));
                    if ((c.references || []).length) out.push('', 'Refs: ' + c.references.map(r => `[${r.title}](${r.url})`).join(' · '));
                    out.push('', '---', '');
                }
            }
        }
        const blob = new Blob([out.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cmdref-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.md';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this.toast('Exported ' + cards.length + ' commands to Markdown');
    }

    /* ---------- events ---------- */
    bindEvents() {
        // Delegated click handling for the command list - bound ONCE, so windowed/appended
        // cards work without per-card listeners.
        const listEl = document.getElementById('commandList');
        listEl.addEventListener('click', e => {
            const star = e.target.closest('.fav-star');
            if (star) { e.stopPropagation(); this.toggleFavorite(star.dataset.fav); return; }
            const card = e.target.closest('.command-card');
            if (card) {
                const cmd = this.commands.find(x => x.id === card.dataset.id);
                if (cmd) this.selectCommand(cmd);
            }
        });

        // Debounced search - avoids a full re-filter/re-render on every keystroke.
        document.getElementById('searchBox').addEventListener('input', e => {
            this.filters.search = e.target.value;
            clearTimeout(this._searchDebounce);
            this._searchDebounce = setTimeout(() => this.renderCommands(), 120);
        });
        // engagements: select + menu
        const engSel = document.getElementById('engSelect');
        if (engSel) engSel.addEventListener('change', e => this.switchEngagement(e.target.value));
        const engMenuBtn = document.getElementById('engMenuBtn');
        const engMenu = document.getElementById('engMenu');
        if (engMenuBtn && engMenu) {
            engMenuBtn.addEventListener('click', e => { e.stopPropagation(); engMenu.hidden = !engMenu.hidden; });
            document.addEventListener('click', e => { if (!engMenu.contains(e.target) && e.target !== engMenuBtn) engMenu.hidden = true; });
            engMenu.addEventListener('click', e => {
                const act = e.target.dataset && e.target.dataset.eng;
                if (!act) return;
                engMenu.hidden = true;
                if (act === 'save') {
                    const name = this.activeEng || (prompt('Name this engagement:') || '').trim();
                    if (name) this.saveEngagement(name);
                } else if (act === 'saveas') {
                    const name = (prompt('New engagement name:') || '').trim();
                    if (name) this.saveEngagement(name);
                } else if (act === 'rename') {
                    if (!this.activeEng) { this.toast('No engagement selected'); return; }
                    const name = (prompt('Rename to:', this.activeEng) || '').trim();
                    if (name && name !== this.activeEng) {
                        this.engagements[name] = this.engagements[this.activeEng];
                        delete this.engagements[this.activeEng];
                        this.saveEngagements(); this.setActiveEng(name); this.renderEngSelect();
                    }
                } else if (act === 'delete') {
                    if (this.activeEng && confirm('Delete engagement "' + this.activeEng + '"?')) this.deleteEngagement(this.activeEng);
                    else if (!this.activeEng) this.toast('No engagement selected');
                } else if (act === 'export') {
                    this.exportEngagements();
                } else if (act === 'import') {
                    document.getElementById('engImport').click();
                } else if (act === 'backup') {
                    this.exportAllData();
                } else if (act === 'restore') {
                    document.getElementById('dataImport').click();
                }
            });
        }
        const engImport = document.getElementById('engImport');
        if (engImport) engImport.addEventListener('change', e => { if (e.target.files[0]) this.importEngagements(e.target.files[0]); e.target.value = ''; });
        const dataImport = document.getElementById('dataImport');
        if (dataImport) dataImport.addEventListener('change', e => { if (e.target.files[0]) this.importAllData(e.target.files[0]); e.target.value = ''; });

        // guide overlay
        const guideBtn = document.getElementById('guideBtn');
        const guideOverlay = document.getElementById('guideOverlay');
        const guideClose = document.getElementById('guideClose');
        if (guideBtn && guideOverlay) {
            const openGuide = () => { guideOverlay.hidden = false; this._focusManage('guideOverlay'); };
            const closeGuide = () => { guideOverlay.hidden = true; this._focusRelease(); };
            guideBtn.addEventListener('click', openGuide);
            if (guideClose) guideClose.addEventListener('click', closeGuide);
            guideOverlay.addEventListener('click', e => { if (e.target === guideOverlay) closeGuide(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGuide(); });
        }

        // attack-path map overlay
        this.bindGraph();
        // study mode + coverage dashboards
        this.bindStudy();
        this.bindCoverage();

        // top-bar Filters popover (overlays, doesn't push layout)
        const filterBtn = document.getElementById('filterBtn');
        const filterPop = document.getElementById('filterPop');
        if (filterBtn && filterPop) {
            filterBtn.addEventListener('click', e => { e.stopPropagation(); filterPop.hidden = !filterPop.hidden; });
            filterPop.addEventListener('click', e => e.stopPropagation());
            document.addEventListener('click', e => { if (!filterPop.contains(e.target) && !filterBtn.contains(e.target)) filterPop.hidden = true; });
        }

        // search tips popover
        const helpBtn = document.getElementById('searchHelp');
        const helpPop = document.getElementById('searchHelpPop');
        if (helpBtn && helpPop) {
            helpBtn.addEventListener('click', e => { e.stopPropagation(); helpPop.hidden = !helpPop.hidden; });
            document.addEventListener('click', e => { if (!helpPop.contains(e.target) && e.target !== helpBtn) helpPop.hidden = true; });
        }
        ['certFilter', 'typeFilter', 'platformFilter', 'opsecFilter', 'requiresFilter', 'protocolFilter', 'toolFilter'].forEach(id => {
            const el = document.getElementById(id); if (!el) return;
            el.addEventListener('change', e => {
                this.filters[id.replace('Filter', '')] = e.target.value;
                this.renderCommands();
            });
        });
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportMarkdown());
        const treeToggle = document.getElementById('treeToggleAll');
        if (treeToggle) treeToggle.addEventListener('click', () => {
            const cats = [...document.querySelectorAll('#categoryTree .tree-cat')];
            const anyClosed = cats.some(c => !c.classList.contains('open'));
            cats.forEach(c => c.classList.toggle('open', anyClosed));
            treeToggle.textContent = anyClosed ? 'Collapse all' : 'Expand all';
        });
        document.getElementById('favToggle').addEventListener('click', () => {
            this.showFavoritesOnly = !this.showFavoritesOnly;
            if (this.showFavoritesOnly) { this.showRecentOnly = false; document.getElementById('recentToggle').classList.remove('active'); }
            document.getElementById('favToggle').classList.toggle('active', this.showFavoritesOnly);
            document.getElementById('viewTitle').textContent = this.showFavoritesOnly ? 'Favorites' : 'All Commands';
            this.renderCommands();
        });
        const recentBtn = document.getElementById('recentToggle');
        if (recentBtn) recentBtn.addEventListener('click', () => {
            this.showRecentOnly = !this.showRecentOnly;
            if (this.showRecentOnly) { this.showFavoritesOnly = false; document.getElementById('favToggle').classList.remove('active'); }
            recentBtn.classList.toggle('active', this.showRecentOnly);
            document.getElementById('viewTitle').textContent = this.showRecentOnly ? 'Recently Used' : 'All Commands';
            this.renderCommands();
        });
        const collFilter = document.getElementById('collectionFilter');
        if (collFilter) collFilter.addEventListener('change', e => {
            this.showCollection = e.target.value;
            if (this.showCollection) {
                this.showFavoritesOnly = false; this.showRecentOnly = false;
                document.getElementById('favToggle').classList.remove('active');
                document.getElementById('recentToggle').classList.remove('active');
            }
            document.getElementById('viewTitle').textContent = this.showCollection ? ('Collection: ' + this.showCollection) : 'All Commands';
            this.renderCommands();
        });
        // context-bar inputs are wired in buildContextBar() (they're re-created on toggle).
        const tcToggle = document.getElementById('tcToggle');
        if (tcToggle) tcToggle.addEventListener('click', () => {
            this.showAllVars = !this.showAllVars;
            this.buildContextBar();
        });
        document.getElementById('clearContext').addEventListener('click', () => {
            this.paramValues = {};
            this.saveContext();
            this.buildContextBar();
            if (this.selectedCommand) this.renderBuilder();
        });
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault(); document.getElementById('searchBox').focus(); return;
            }
            // don't hijack arrows/Enter while typing in a value field (except the search box)
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' && e.target.id !== 'searchBox') return;
            if (tag === 'textarea') return;
            if (e.key === 'ArrowDown') { e.preventDefault(); this.focusMove(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.focusMove(-1); }
            else if (e.key === 'Enter') { this.focusOpen(); }
            else if (e.key === 'Escape') { const el = document.getElementById('sidebar'); if (el) el.classList.remove('open'); }
        });

        // red / blue / both mode toggle
        const modeToggle = document.getElementById('modeToggle');
        if (modeToggle) modeToggle.addEventListener('click', e => {
            const btn = e.target.closest('.mode-btn');
            if (!btn || !btn.dataset.mode) return;
            this.mode = btn.dataset.mode;
            this.saveMode();
            this.applyMode();
            this.buildCategoryTree();
            this.renderCommands();
        });

        // mobile sidebar drawer
        const menuBtn = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        const setDrawer = open => {
            if (sidebar) sidebar.classList.toggle('open', open);
            if (backdrop) backdrop.classList.toggle('show', open);
        };
        if (menuBtn) menuBtn.addEventListener('click', () => setDrawer(!sidebar.classList.contains('open')));
        if (backdrop) backdrop.addEventListener('click', () => setDrawer(false));
        // tapping a category on mobile closes the drawer
        document.getElementById('categoryTree').addEventListener('click', e => {
            if (window.innerWidth <= 760 && e.target.closest('.tree-sub-item, .tree-group-head')) setDrawer(false);
        });
        // Escape closes it too (handled in the keydown above via .remove('open')); keep backdrop synced
        document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
    }

    updateCommandCount() {
        document.getElementById('commandCount').textContent = this.total + ' commands';
    }

    /* ===================== Attack-Path Map ===================== */
    openGraph(centerId) {
        const overlay = document.getElementById('graphOverlay');
        if (!overlay) return;
        let id = centerId || (this.selectedCommand && this.selectedCommand.id);
        if (!id || !this.byId[id]) {
            const rich = this.commands.find(c => (c.recommended || []).length) || this.commands[0];
            id = rich && rich.id;
        }
        if (!id) return;
        this.graphCenter = id;
        const dl = document.getElementById('graphCardList');
        if (dl && !dl.dataset.filled) {
            dl.innerHTML = this.commands.map(c => '<option value="' + this.esc(c.name) + '">').join('');
            dl.dataset.filled = '1';
        }
        const qg = document.getElementById('graphQuickGoals');
        if (qg && !qg.dataset.filled) {
            const GOALS = ['crtp-golden-ticket', 'crtp-dcsync', 'golden-ticket', 'dcsync', 'crtp-domain-admin', 'ntds-dump', 'secretsdump', 'crtp-krbtgt', 'crtp-silver-ticket'];
            const seen = new Set(), found = [];
            GOALS.forEach(g => { if (this.byId[g] && !seen.has(g)) { seen.add(g); found.push(this.byId[g]); } });
            qg.innerHTML = found.slice(0, 4).map(c => '<button class="graph-quick-goal" data-goal="' + this.esc(c.id) + '">→ ' + this.esc(c.name.split(/[\(—-]/)[0].trim().slice(0, 20)) + '</button>').join('');
            qg.dataset.filled = '1';
        }
        overlay.hidden = false;
        const search = document.getElementById('graphSearch');
        if (search) search.value = this.byId[id] ? this.byId[id].name : '';
        const pr = document.getElementById('graphPathResult');
        if (pr) { pr.hidden = true; pr.innerHTML = ''; }
        this.graphZoom = null;   // null = auto-fit
        this.renderGraph();
        this._focusManage('graphOverlay');
    }
    closeGraph() { const o = document.getElementById('graphOverlay'); if (o) o.hidden = true; this._focusRelease(); }
    // Accessibility: on modal open, focus the first control and remember what had focus; trap Tab
    // inside the modal; on close, return focus to the trigger. Used by all overlays.
    _focusManage(overlayId) {
        const ov = document.getElementById(overlayId); if (!ov) return;
        const modal = ov.firstElementChild || ov;
        this._modalPrevFocus = document.activeElement;
        const focusables = () => [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        const f = focusables(); if (f.length) { try { f[0].focus(); } catch (e) {} }
        if (this._modalTrapEl && this._modalTrap) this._modalTrapEl.removeEventListener('keydown', this._modalTrap);
        this._modalTrap = e => {
            if (e.key !== 'Tab') return;
            const els = focusables(); if (!els.length) return;
            const first = els[0], last = els[els.length - 1], a = document.activeElement;
            if (e.shiftKey && (a === first || !modal.contains(a))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (a === last || !modal.contains(a))) { e.preventDefault(); first.focus(); }
        };
        modal.addEventListener('keydown', this._modalTrap);
        this._modalTrapEl = modal;
    }
    _focusRelease() {
        if (this._modalTrapEl && this._modalTrap) this._modalTrapEl.removeEventListener('keydown', this._modalTrap);
        this._modalTrap = null; this._modalTrapEl = null;
        if (this._modalPrevFocus && this._modalPrevFocus.focus) { try { this._modalPrevFocus.focus(); } catch (e) {} }
        this._modalPrevFocus = null;
    }
    zoomGraph(mode) {
        if (mode === 'fit') this.graphZoom = null;
        else this.graphZoom = Math.max(0.2, Math.min(3, (this._effZoom || 1) * (mode === 'in' ? 1.25 : 0.8)));
        this.renderGraph();
    }

    buildGraphModel(centerId) {
        const OUT = 2, IN = 1;
        const byId = this.byId, rev = this.reverseRec;
        const center = byId[centerId];
        if (!center) return null;
        const mk = (c, depth, rel) => ({ id: c.id, name: c.name, depth, rel, opsec: c.opsec });
        const FWD = new Set(['next', 'escalation']);   // relationships that move the attack forward
        // successors = comes AFTER this card (drawn to the RIGHT): its own next/escalation/alternative,
        // plus any card that lists THIS as a prereq (that card can only run after this one).
        const succ = id => {
            const out = [];
            (byId[id].recommended || []).forEach(r => { if (r && r.id && byId[r.id] && r.rel !== 'prereq') out.push({ id: r.id, rel: r.rel || 'next' }); });
            (rev[id] || []).forEach(s => { if (s && s.id && byId[s.id] && s.rel === 'prereq') out.push({ id: s.id, rel: 'next' }); });
            return out;
        };
        // predecessors = comes BEFORE this card (drawn to the LEFT): its own prereq links, plus any
        // card that recommends THIS as a next/escalation step (that card leads here).
        const pred = id => {
            const out = [];
            (byId[id].recommended || []).forEach(r => { if (r && r.id && byId[r.id] && r.rel === 'prereq') out.push({ id: r.id, rel: 'prereq' }); });
            (rev[id] || []).forEach(s => { if (s && s.id && byId[s.id] && FWD.has(s.rel || 'next')) out.push({ id: s.id, rel: s.rel || 'next' }); });
            return out;
        };
        const nodes = new Map();
        const edges = [];
        nodes.set(centerId, mk(center, 0, 'center'));
        let frontier = [centerId];
        for (let d = 1; d <= OUT; d++) {
            const next = [];
            frontier.forEach(pid => succ(pid).forEach(r => {
                edges.push({ from: pid, to: r.id, rel: r.rel });
                if (!nodes.has(r.id)) { nodes.set(r.id, mk(byId[r.id], d, r.rel)); next.push(r.id); }
            }));
            frontier = next;
        }
        frontier = [centerId];
        for (let d = 1; d <= IN; d++) {
            const prev = [];
            frontier.forEach(cid => pred(cid).forEach(r => {
                edges.push({ from: r.id, to: cid, rel: r.rel });
                if (!nodes.has(r.id)) { nodes.set(r.id, mk(byId[r.id], -d, r.rel)); prev.push(r.id); }
            }));
            frontier = prev;
        }
        const cols = {};
        [...nodes.values()].forEach(n => (cols[n.depth] = cols[n.depth] || []).push(n));
        return { cols, edges, centerId };   // no cap - every node is shown; zoom/scroll handles size
    }

    // wrap a card name onto up to 2 short lines so labels fit inside a node without hard truncation
    graphWrap(s) {
        const words = String(s).split(/\s+/), L = ['', ''];
        let li = 0;
        for (const w of words) {
            if (!L[li]) L[li] = w;
            else if ((L[li] + ' ' + w).length <= 24) L[li] += ' ' + w;
            else if (li === 0) { li = 1; L[1] = w; }
            else { L[1] += '…'; break; }
        }
        L[0] = L[0].slice(0, 26); L[1] = L[1].slice(0, 26);
        return L[1] ? [L[0], L[1]] : [L[0]];
    }

    renderGraph() {
        const canvas = document.getElementById('graphCanvas');
        const model = this.buildGraphModel(this.graphCenter);
        if (!canvas) return;
        if (!model) { canvas.innerHTML = '<p style="padding:24px;color:var(--muted)">No chain data for this command.</p>'; return; }
        const REL_COLOR = { center: '#58a6ff', prereq: '#d29922', next: '#3fb950', escalation: '#ff7b72', alternative: '#bc8cff', cleanup: '#8b949e' };
        const OPSEC = { silent: '#4ea1ff', quiet: '#35c46a', moderate: '#e2b53d', loud: '#e5484d' };
        const NW = 176, NH = 50, VGAP = 18, HGAP = 96;
        const depths = Object.keys(model.cols).map(Number).sort((a, b) => a - b);
        const colX = {}; depths.forEach((d, i) => colX[d] = 24 + i * (NW + HGAP));
        const maxRows = Math.max(1, ...depths.map(d => model.cols[d].length));
        const H = Math.max(280, 36 + maxRows * (NH + VGAP));
        const W = 24 + depths.length * (NW + HGAP) - HGAP + 24;
        const pos = {}, depthOf = {};
        depths.forEach(d => {
            const col = model.cols[d];
            const colH = col.length * (NH + VGAP) - VGAP;
            let y = Math.max(18, (H - colH) / 2);
            col.forEach(n => { pos[n.id] = { x: colX[d], y }; depthOf[n.id] = d; y += NH + VGAP; });
        });
        // one colored arrowhead marker per relationship, tip touching the target box
        const markerDefs = Object.keys(REL_COLOR).map(k =>
            '<marker id="garrow-' + k + '" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">' +
            '<path d="M0,0 L10,5 L0,10 z" fill="' + REL_COLOR[k] + '"/></marker>').join('');
        // draw only forward-adjacent edges (column d -> d+1); this drops the backward/cross
        // links that otherwise arrow into the LEFT side of boxes and clutter the map.
        const seenEdge = new Set();
        let edgeSvg = '';
        model.edges.forEach(e => {
            const a = pos[e.from], b = pos[e.to];
            if (!a || !b) return;
            if (depthOf[e.to] !== depthOf[e.from] + 1) return;
            const key = e.from + '>' + e.to;
            if (seenEdge.has(key)) return;
            seenEdge.add(key);
            const rel = REL_COLOR[e.rel] ? e.rel : 'next';
            const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x - 1, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
            edgeSvg += '<path class="gedge" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" stroke="' + REL_COLOR[rel] + '" marker-end="url(#garrow-' + rel + ')"/>';
        });
        let nodeSvg = '';
        depths.forEach(d => {
            model.cols[d].forEach(n => {
                const p = pos[n.id];
                const col = REL_COLOR[n.rel] || '#8b949e';
                const isC = n.id === model.centerId;
                const lines = this.graphWrap(n.name);
                const ty = lines.length === 2 ? [NH / 2 - 3, NH / 2 + 12] : [NH / 2 + 4];
                const txt = lines.map((ln, i) => '<text x="14" y="' + ty[i] + '">' + this.esc(ln) + '</text>').join('');
                const pip = OPSEC[n.opsec] ? '<circle cx="' + (NW - 11) + '" cy="12" r="4" fill="' + OPSEC[n.opsec] + '"><title>opsec: ' + n.opsec + '</title></circle>' : '';
                nodeSvg += '<g class="gnode' + (isC ? ' center' : '') + '" data-gid="' + this.esc(n.id) + '" transform="translate(' + p.x + ',' + p.y + ')">' +
                    '<rect width="' + NW + '" height="' + NH + '" rx="9" fill="' + (isC ? 'rgba(88,166,255,.18)' : '#161b22') + '" stroke="' + col + '"/>' +
                    pip + txt + '</g>';
            });
        });
        // zoom: null = fit-to-view (capped at natural size); otherwise a manual factor
        const cw = canvas.clientWidth || 960, ch = canvas.clientHeight || 520;
        let z = this.graphZoom;
        if (!z) { z = Math.min(cw / W, ch / H, 1); if (!isFinite(z) || z <= 0) z = 1; }
        this._effZoom = z;
        canvas.innerHTML = '<svg width="' + Math.round(W * z) + '" height="' + Math.round(H * z) + '" viewBox="0 0 ' + W + ' ' + H + '">' +
            '<defs>' + markerDefs + '</defs>' + edgeSvg + nodeSvg + '</svg>';
    }

    graphPathTo(goalId) {
        const byId = this.byId, start = this.graphCenter;
        if (!byId[goalId] || !byId[start]) return null;
        if (goalId === start) return [start];
        const q = [[start]], seen = new Set([start]);
        while (q.length) {
            const path = q.shift(), last = path[path.length - 1];
            for (const r of (byId[last].recommended || [])) {
                if (!r || !r.id || !byId[r.id] || seen.has(r.id)) continue;
                const np = path.concat(r.id);
                if (r.id === goalId) return np;
                seen.add(r.id); q.push(np);
            }
        }
        return null;
    }

    showGraphPath(goalId) {
        const pr = document.getElementById('graphPathResult');
        if (!pr || !this.byId[goalId]) return;
        const path = this.graphPathTo(goalId);
        pr.hidden = false;
        if (!path) {
            pr.innerHTML = '<b>No forward path</b> from “' + this.esc(this.byId[this.graphCenter].name) + '” to “' + this.esc(this.byId[goalId].name) + '” via recommended links. Try re-centering on an earlier step.';
            return;
        }
        const chain = path.map((id, i) =>
            (i ? '<span class="gpr-arrow">→</span>' : '') +
            '<span class="gpr-node" data-gid="' + this.esc(id) + '">' + this.esc(this.byId[id].name.split(/[\(—]/)[0].trim().slice(0, 30)) + '</span>'
        ).join(' ');
        pr.innerHTML = '<b>' + (path.length - 1) + '-step path:</b><div class="gpr-chain">' + chain + '</div>';
    }

    bindGraph() {
        const btn = document.getElementById('graphBtn');
        if (btn) btn.addEventListener('click', () => this.openGraph());
        const close = document.getElementById('graphClose');
        if (close) close.addEventListener('click', () => this.closeGraph());
        const overlay = document.getElementById('graphOverlay');
        if (overlay) {
            overlay.addEventListener('click', e => { if (e.target === overlay) this.closeGraph(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) this.closeGraph(); });
        }
        const canvas = document.getElementById('graphCanvas');
        if (canvas) canvas.addEventListener('click', e => {
            const g = e.target.closest('.gnode'); if (!g) return;
            const id = g.dataset.gid; if (!id || !this.byId[id]) return;
            this.graphCenter = id;
            const s = document.getElementById('graphSearch'); if (s) s.value = this.byId[id].name;
            this.selectCommand(this.byId[id]);
            this.renderGraph();
        });
        const byName = name => this.commands.find(c => c.name === name);
        const search = document.getElementById('graphSearch');
        if (search) search.addEventListener('change', () => { const c = byName(search.value); if (c) { this.graphCenter = c.id; this.selectCommand(c); this.renderGraph(); } });
        const goal = document.getElementById('graphGoal');
        if (goal) goal.addEventListener('change', () => { const c = byName(goal.value); if (c) this.showGraphPath(c.id); });
        const qg = document.getElementById('graphQuickGoals');
        if (qg) qg.addEventListener('click', e => { const b = e.target.closest('[data-goal]'); if (b) this.showGraphPath(b.dataset.goal); });
        const pr = document.getElementById('graphPathResult');
        if (pr) pr.addEventListener('click', e => { const n = e.target.closest('[data-gid]'); if (n && this.byId[n.dataset.gid]) { this.graphCenter = n.dataset.gid; const s = document.getElementById('graphSearch'); if (s) s.value = this.byId[n.dataset.gid].name; this.selectCommand(this.byId[n.dataset.gid]); this.renderGraph(); } });
        const zoom = document.querySelector('.graph-zoom');
        if (zoom) zoom.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (b) this.zoomGraph(b.dataset.z); });
        const gexp = document.getElementById('graphExport');
        if (gexp) gexp.addEventListener('click', () => this.exportPathMarkdown());
    }

    /* ===================== Study Mode ===================== */
    shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    openStudy() {
        const ov = document.getElementById('studyOverlay'); if (!ov) return;
        if (!this.study) this.study = { mode: 'flash', scope: 'all' };
        if (!this.studyWeak) this.studyWeak = this.loadStudyWeak();
        const scopeSel = document.getElementById('studyScope');
        if (scopeSel) {   // rebuilt each open so the Weak-areas count stays current
            const certs = [...new Set(this.commands.flatMap(c => c.certifications || []))].sort();
            const weakN = this.studyWeak.size;
            scopeSel.innerHTML = '<option value="all">All commands</option>' +
                (weakN ? '<option value="weak">⚠ Weak areas (' + weakN + ')</option>' : '') +
                '<option value="fav">★ Favorites</option>' +
                certs.map(c => '<option value="cert:' + this.esc(c) + '">' + this.esc(c) + '</option>').join('');
            scopeSel.value = this.study.scope || 'all';
        }
        ov.hidden = false;
        this.startStudy();
        this._focusManage('studyOverlay');
    }
    closeStudy() { const o = document.getElementById('studyOverlay'); if (o) o.hidden = true; this._focusRelease(); }
    loadStudyWeak() { try { return new Set(JSON.parse(localStorage.getItem('cr_study_weak') || '[]')); } catch (e) { return new Set(); } }
    saveStudyWeak() { try { localStorage.setItem('cr_study_weak', JSON.stringify([...this.studyWeak])); } catch (e) {} }
    // spaced-repetition memory: a card you miss ("Review again" / wrong quiz answer) is remembered
    // across sessions and resurfaced under the "Weak areas" scope; recalling it clears it.
    markWeak(id, isWeak) {
        if (!id) return;
        if (!this.studyWeak) this.studyWeak = this.loadStudyWeak();
        if (isWeak) this.studyWeak.add(id); else this.studyWeak.delete(id);
        this.saveStudyWeak();
    }
    studyPool() {
        const s = this.study.scope || 'all';
        let pool = this.commands.filter(c => c.command && String(c.command).trim());
        if (s === 'weak') pool = pool.filter(c => this.studyWeak && this.studyWeak.has(c.id));
        else if (s === 'fav') pool = pool.filter(c => this.favorites && this.favorites.has(c.id));
        else if (s.indexOf('cert:') === 0) { const cert = s.slice(5); pool = pool.filter(c => (c.certifications || []).includes(cert)); }
        return pool;
    }
    startStudy() {
        this.study.pool = this.shuffleArr(this.studyPool().map(c => c.id));
        this.study.idx = 0; this.study.seen = 0; this.study.got = 0; this.study.revealed = false; this.study.answered = false; this.study.current = null;
        this.renderStudy();
    }
    renderStudy() {
        const body = document.getElementById('studyBody'); if (!body) return;
        const total = this.study.pool.length;
        const bar = document.getElementById('studyBar'); if (bar) bar.style.width = total ? Math.round(this.study.idx / total * 100) + '%' : '0%';
        const scoreEl = document.getElementById('studyScore');
        if (!total) { body.innerHTML = '<p class="study-empty">No commands in this scope — pick another above.</p>'; if (scoreEl) scoreEl.textContent = ''; return; }
        if (this.study.idx >= total) return this.renderStudyDone();
        if (scoreEl) scoreEl.textContent = (this.study.mode === 'flash' ? 'Recalled ' : 'Correct ') + this.study.got + ' / ' + this.study.seen + '   ·   ' + (this.study.idx + 1) + ' of ' + total;
        if (this.study.mode === 'flash') this.renderFlashcard(); else this.renderQuiz();
    }
    renderFlashcard() {
        const body = document.getElementById('studyBody');
        const c = this.byId[this.study.pool[this.study.idx]];
        if (!c) { this.study.idx++; return this.renderStudy(); }
        const meta = [c.category, c.subcategory, c.platform, c.opsec].filter(Boolean).map(x => '<span class="flash-chip">' + this.esc(x) + '</span>').join('');
        let html = '<div class="flash-card"><div class="flash-meta">' + meta + '</div><div class="flash-q">' + this.esc(c.name) + '</div>' +
            (c.description ? '<div class="flash-desc">' + this.esc(c.description) + '</div>' : '');
        if (!this.study.revealed) {
            html += '<div class="flash-prompt">Recall the command from memory, then reveal.</div><div class="study-btns"><button class="study-btn primary" data-act="reveal">Reveal command</button></div>';
        } else {
            const vars = (c.variations || []).slice(0, 5).map(v => v.label).filter(Boolean).join('  ·  ');
            html += '<div class="flash-answer"><pre>' + this.esc(c.command) + '</pre>' + (vars ? '<div class="flash-var">Variations: ' + this.esc(vars) + '</div>' : '') + '</div>' +
                '<div class="study-btns"><button class="study-btn again" data-act="again">Review again</button><button class="study-btn good" data-act="got">Got it ✓</button></div>';
        }
        body.innerHTML = html + '</div>';
    }
    renderQuiz() {
        const body = document.getElementById('studyBody');
        const c = this.byId[this.study.pool[this.study.idx]];
        if (!c) { this.study.idx++; return this.renderStudy(); }
        const q = this.buildQuizQuestion(c);
        this.study.current = q;
        body.innerHTML = '<div class="quiz-card"><div class="quiz-q"><span class="qmark">Q.</span> ' + q.q + '</div><div class="quiz-opts">' +
            q.options.map((o, i) => '<button class="quiz-opt" data-opt="' + i + '">' + o.html + '</button>').join('') +
            '</div><div class="quiz-feedback" id="quizFeedback"></div></div>';
    }
    buildQuizQuestion(c) {
        const rand = arr => arr[Math.floor(Math.random() * arr.length)];
        const pick = (arr, n, exclude) => { const p = arr.filter(x => !exclude.has(x.id)); this.shuffleArr(p); return p.slice(0, n); };
        const nexts = (c.recommended || []).filter(r => (r.rel === 'next' || r.rel === 'escalation') && this.byId[r.id]);
        if (nexts.length) {
            const correct = this.byId[rand(nexts).id];
            const distract = pick(this.commands, 3, new Set([c.id, correct.id]));
            const opts = this.shuffleArr([{ ok: true, html: this.esc(correct.name) }].concat(distract.map(d => ({ ok: false, html: this.esc(d.name) }))));
            return { q: 'After <b>' + this.esc(c.name) + '</b>, which is a recommended next step?', options: opts };
        }
        const firstLine = s => this.esc(String(s || '').split('\n')[0].slice(0, 82));
        const distract = pick(this.commands.filter(x => x.command), 3, new Set([c.id]));
        const opts = this.shuffleArr([{ ok: true, html: '<code>' + firstLine(c.command) + '</code>' }].concat(distract.map(d => ({ ok: false, html: '<code>' + firstLine(d.command) + '</code>' }))));
        return { q: 'Which command performs: <b>' + this.esc(c.name) + '</b>?', options: opts };
    }
    studyReveal() { this.study.revealed = true; this.renderStudy(); }
    studyGrade(got) { this.markWeak(this.study.pool[this.study.idx], !got); this.study.seen++; if (got) this.study.got++; this.study.idx++; this.study.revealed = false; this.renderStudy(); }
    studyAnswer(i) {
        if (this.study.answered) return;
        const q = this.study.current; if (!q) return;
        this.study.answered = true; this.study.seen++;
        this.markWeak(this.study.pool[this.study.idx], !q.options[i].ok);
        if (q.options[i].ok) this.study.got++;
        document.querySelectorAll('#studyBody .quiz-opt').forEach((el, k) => {
            el.classList.add('disabled');
            if (q.options[k].ok) el.classList.add('correct');
            else if (k === i) el.classList.add('wrong');
        });
        const fb = document.getElementById('quizFeedback');
        if (fb) fb.innerHTML = (q.options[i].ok ? '<span style="color:#3fb950">Correct.</span>' : '<span style="color:#e5484d">Not quite — the right answer is highlighted.</span>') +
            ' <button class="study-btn primary" data-act="next" style="margin-left:10px;padding:6px 16px">Next →</button>';
        const sc = document.getElementById('studyScore'); if (sc) sc.textContent = 'Correct ' + this.study.got + ' / ' + this.study.seen + '   ·   ' + (this.study.idx + 1) + ' of ' + this.study.pool.length;
    }
    studyNext() { this.study.idx++; this.study.answered = false; this.study.current = null; this.renderStudy(); }
    renderStudyDone() {
        const body = document.getElementById('studyBody');
        const pct = this.study.seen ? Math.round(this.study.got / this.study.seen * 100) : 0;
        body.innerHTML = '<div class="study-empty"><div style="font-size:2.4rem;font-weight:700;color:var(--accent)">' + pct + '%</div>' +
            '<p>' + (this.study.mode === 'flash' ? 'Recalled ' : 'Correct on ') + this.study.got + ' of ' + this.study.seen + '.</p>' +
            '<div class="study-btns"><button class="study-btn primary" data-act="restart">Study again</button></div></div>';
        const bar = document.getElementById('studyBar'); if (bar) bar.style.width = '100%';
    }
    bindStudy() {
        const btn = document.getElementById('studyBtn'); if (btn) btn.addEventListener('click', () => this.openStudy());
        const close = document.getElementById('studyClose'); if (close) close.addEventListener('click', () => this.closeStudy());
        const ov = document.getElementById('studyOverlay');
        if (ov) { ov.addEventListener('click', e => { if (e.target === ov) this.closeStudy(); }); document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) this.closeStudy(); }); }
        document.querySelectorAll('.smode-btn').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.smode-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
            this.study.mode = b.dataset.smode; this.startStudy();
        }));
        const scope = document.getElementById('studyScope'); if (scope) scope.addEventListener('change', () => { this.study.scope = scope.value; this.startStudy(); });
        const shuffle = document.getElementById('studyShuffle'); if (shuffle) shuffle.addEventListener('click', () => this.startStudy());
        const restart = document.getElementById('studyRestart'); if (restart) restart.addEventListener('click', () => this.startStudy());
        const body = document.getElementById('studyBody');
        if (body) body.addEventListener('click', e => {
            const b = e.target.closest('[data-act], [data-opt]'); if (!b) return;
            if (b.dataset.opt !== undefined) return this.studyAnswer(parseInt(b.dataset.opt, 10));
            const act = b.dataset.act;
            if (act === 'reveal') this.studyReveal();
            else if (act === 'got') this.studyGrade(true);
            else if (act === 'again') this.studyGrade(false);
            else if (act === 'next') this.studyNext();
            else if (act === 'restart') this.startStudy();
        });
    }

    /* ===================== Coverage dashboards ===================== */
    openCoverage() { const ov = document.getElementById('coverageOverlay'); if (!ov) return; ov.hidden = false; this.covTab = this.covTab || 'mitre'; this.renderCoverage(); this._focusManage('coverageOverlay'); }
    closeCoverage() { const o = document.getElementById('coverageOverlay'); if (o) o.hidden = true; this._focusRelease(); }
    renderCoverage() {
        const body = document.getElementById('coverageBody'); if (!body) return;
        if (this.covTab === 'cert') return this.renderCoverageCert(body);
        if (this.covTab === 'tool') return this.renderCoverageTool(body);
        if (this.covTab === 'source') return this.renderCoverageSource(body);
        return this.renderCoverageMitre(body);
    }
    renderCoverageSource(body) {
        const data = (typeof COVERAGE_DATA !== 'undefined') ? COVERAGE_DATA : null;
        if (!data) { body.innerHTML = '<p class="cov-note">No coverage snapshot found. Run <code>node coverage-report.js</code> to generate <code>js/coverage-data.js</code>.</p>'; return; }
        const col = p => p >= 95 ? '#3fb950' : (p >= 80 ? '#d29922' : '#e5484d');
        const rows = data.modules.filter(m => m.total > 0);
        body.innerHTML = '<p class="cov-note"><b>' + this.esc(data.cert) + ' source tool-coverage: ' + data.overallPct + '%</b> — of the distinct tools each module\'s course notes use, how many appear in at least one card. Snapshot ' + this.esc(data.generated) + ' (regenerate with <code>node coverage-report.js</code>). Modules with 0 tools (pure theory) omitted.</p>' +
            rows.map(m => {
                const tip = m.uncarded.length ? ' title="not carded: ' + this.esc(m.uncarded.join(', ')) + '"' : '';
                return '<div class="cov-bar-row"' + tip + '><div class="cov-bar-label">' + this.esc(m.mod + ' ' + m.name) + '</div>' +
                    '<div class="cov-bar-track"><div class="cov-bar-fill" style="width:' + m.pct + '%;background:' + col(m.pct) + '"></div></div>' +
                    '<div class="cov-bar-val">' + m.pct + '% (' + m.carded + '/' + m.total + ')</div></div>';
            }).join('');
    }
    renderCoverageMitre(body) {
        const tally = {};
        this.commands.forEach(c => (c.mitre || []).forEach(t => { const base = String(t).split('.')[0]; (tally[base] = tally[base] || { ids: new Set(), sub: new Set() }); tally[base].ids.add(c.id); if (String(t).indexOf('.') >= 0) tally[base].sub.add(t); }));
        const rows = Object.entries(tally).sort((a, b) => b[1].ids.size - a[1].ids.size);
        const withMitre = this.commands.filter(c => (c.mitre || []).length).length;
        body.innerHTML = '<p class="cov-note">' + rows.length + ' ATT&CK techniques referenced across ' + withMitre + ' of ' + this.commands.length + ' cards. Click a technique to search it.</p><div class="cov-grid">' +
            rows.map(([t, v]) => '<div class="cov-cell" data-covsearch="mitre:' + this.esc(t) + '"><h4>' + this.esc(t) + '</h4><span class="cov-count">' + v.ids.size + '</span><span class="cov-sub">cards' + (v.sub.size ? ' · ' + v.sub.size + ' sub' : '') + '</span></div>').join('') + '</div>';
    }
    renderCoverageCert(body) {
        const byCert = {};
        this.commands.forEach(c => (c.certifications && c.certifications.length ? c.certifications : ['(none)']).forEach(cert => { (byCert[cert] = byCert[cert] || { total: 0, def: 0, chain: 0 }); byCert[cert].total++; if (c.defense && Object.keys(c.defense).length) byCert[cert].def++; if ((c.recommended || []).length) byCert[cert].chain++; }));
        const rows = Object.entries(byCert).sort((a, b) => b[1].total - a[1].total);
        const max = Math.max(1, ...rows.map(r => r[1].total));
        body.innerHTML = '<p class="cov-note">Cards per certification — bar = card count; below each, how many carry defense content and chain links.</p>' +
            rows.map(([cert, v]) => '<div class="cov-bar-row"><div class="cov-bar-label">' + this.esc(cert) + '</div><div class="cov-bar-track"><div class="cov-bar-fill" style="width:' + Math.round(v.total / max * 100) + '%"></div></div><div class="cov-bar-val">' + v.total + '</div></div>' +
                '<div class="cov-bar-row"><div class="cov-bar-label" style="font-size:.7rem;color:var(--muted)">defense ' + Math.round(v.def / v.total * 100) + '%  ·  chains ' + Math.round(v.chain / v.total * 100) + '%</div><div class="cov-bar-track" style="background:none;border:none"></div><div class="cov-bar-val"></div></div>').join('');
    }
    renderCoverageTool(body) {
        const byTool = {};
        this.commands.forEach(c => (c.tools || []).forEach(t => { (byTool[t] = byTool[t] || new Set()).add(c.id); }));
        const rows = Object.entries(byTool).map(([t, s]) => [t, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 48);
        body.innerHTML = '<p class="cov-note">Top tools by card count (click to filter the library). ' + Object.keys(byTool).length + ' tools total.</p><div class="cov-grid">' +
            rows.map(([t, n]) => '<div class="cov-cell" data-covsearch="tool:' + this.esc(t) + '"><h4>' + this.esc(t) + '</h4><span class="cov-count">' + n + '</span><span class="cov-sub">cards</span></div>').join('') + '</div>';
    }
    bindCoverage() {
        const btn = document.getElementById('coverageBtn'); if (btn) btn.addEventListener('click', () => this.openCoverage());
        const close = document.getElementById('coverageClose'); if (close) close.addEventListener('click', () => this.closeCoverage());
        const ov = document.getElementById('coverageOverlay');
        if (ov) { ov.addEventListener('click', e => { if (e.target === ov) this.closeCoverage(); }); document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) this.closeCoverage(); }); }
        document.querySelectorAll('.cov-tab').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.cov-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
            this.covTab = b.dataset.cov; this.renderCoverage();
        }));
        const body = document.getElementById('coverageBody');
        if (body) body.addEventListener('click', e => {
            const cell = e.target.closest('[data-covsearch]'); if (!cell) return;
            this.closeCoverage();
            const sb = document.getElementById('searchBox'); if (sb) sb.value = cell.dataset.covsearch;
            this.filters.search = cell.dataset.covsearch; this.renderCommands();
        });
    }

    /* ===================== Export helpers (Feature 3) ===================== */
    // Copy the selected card's steps (or its command) as a runnable script, target filled in.
    copyAsScript() {
        const c = this.selectedCommand; if (!c) return;
        const win = c.platform === 'windows';
        const cmds = (c.steps && c.steps.length) ? c.steps.map(s => this.substitute(s.command)) : [this.substitute(this.activeCommandString())];
        const head = win
            ? '# ' + c.name + '  -  Command Reference\n# PowerShell (run elevated where needed)'
            : '#!/usr/bin/env bash\n# ' + c.name + '  -  Command Reference\nset -e';
        this.copyText(head + '\n\n' + cmds.join('\n') + '\n');
        this.toast('Copied as ' + (win ? 'PowerShell' : 'bash') + ' script');
    }
    // Export the current attack-path map (prereqs -> this -> next) as a focused Markdown cheatsheet.
    exportPathMarkdown() {
        const model = this.buildGraphModel(this.graphCenter);
        if (!model) { this.toast('Open a command in the map first'); return; }
        const sub = s => this.substitute(String(s || ''));
        const center = this.byId[model.centerId];
        const depths = Object.keys(model.cols).map(Number).sort((a, b) => a - b);
        const relName = { prereq: 'Prerequisite', next: 'Next step', escalation: 'Escalation', alternative: 'Alternative', cleanup: 'Cleanup' };
        const out = ['# Attack path - ' + center.name, '', '_Generated ' + new Date().toISOString().slice(0, 10) + ' - left->right = prerequisites -> this -> next steps_', ''];
        depths.forEach(d => model.cols[d].forEach(n => {
            const c = this.byId[n.id]; if (!c) return;
            const tag = d < 0 ? 'Leads here' : (d === 0 ? 'YOU ARE HERE' : (relName[n.rel] || 'Next step'));
            out.push('## ' + c.name + '  `' + tag + '`');
            if (c.description) out.push('', c.description);
            out.push('', '```', sub(c.command), '```');
            (c.steps || []).forEach((s, i) => out.push((i + 1) + '. ' + (s.label || ''), '   ```', '   ' + sub(s.command).replace(/\n/g, '\n   '), '   ```'));
            out.push('');
        }));
        const blob = new Blob([out.join('\n')], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'attack-path-' + center.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.md';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        this.toast('Exported attack path (' + Object.values(model.cols).flat().length + ' cards)');
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new CommandManager(); });
