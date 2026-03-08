/**
 * DevPanel for Mat Life: Wrestling Simulator
 * Development-only tools for setting state and creating test saves
 */

import { gameStateManager } from '../core/GameStateManager.js';
import { saveLoadManager } from '../engine/SaveLoadManager.js';
import EntityFactory from '../core/EntityFactory.js';
import AIPromotionSystem from '../engine/AIPromotionSystem.js';
import ChampionshipSystem from '../engine/ChampionshipSystem.js';
import { deserializeComponent } from '../core/Component.js';
import uiManager from './UIManager.js';

export class DevPanel {
  constructor() {
    this.container = document.getElementById('dev-screen');
    this.statusEl = null;
    this.selectedSaveKey = null;
    this.selectedSaveData = null;
    this.jsonEditorMode = 'view';
    this.collapsedNodes = new Set();
    this.entityEditorMode = 'view';
    this.selectedEntityData = null;
  }

  init() {
    if (!this.container) return;
    this.buildUI();
    this.ensureDevState();
    this.populateForm();
    this.refreshEntityList();
    this.refreshAllSaves();
  }

  buildUI() {
    this.container.innerHTML = `
      <div class="dev-container">
        <header class="dev-header">
          <div>
            <h1>Dev Tools</h1>
            <p class="dev-subtitle">Set custom state and create test saves.</p>
          </div>
          <div class="dev-actions">
            <label>Snapshot Name <input id="dev-save-name" type="text" placeholder="my-save" style="width: 100px;"></label>
            <button id="dev-apply-btn" class="btn btn-primary">Apply State</button>
            <button id="dev-apply-play-btn" class="btn btn-secondary">Apply + Play</button>
            <button id="dev-save-btn" class="btn btn-secondary">Save Snapshot</button>
          </div>
        </header>

        <div id="dev-status" class="dev-status"></div>

        <section class="dev-section">
          <h2>Calendar</h2>
          <div class="dev-grid">
            <label>Year <input id="dev-year" type="number" min="1" value="1"></label>
            <label>Month <input id="dev-month" type="number" min="1" max="12" value="1"></label>
            <label>Week <input id="dev-week" type="number" min="1" value="1"></label>
            <label>Day (0=Mon) <input id="dev-day" type="number" min="0" max="6" value="0"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Physical Stats</h2>
          <div class="dev-grid">
            <label>Strength <input id="dev-str" type="number" min="0" max="100"></label>
            <label>Stamina <input id="dev-sta" type="number" min="0" max="100"></label>
            <label>Resilience <input id="dev-res" type="number" min="0" max="100"></label>
            <label>Speed <input id="dev-spd" type="number" min="0" max="100"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>In-Ring Stats</h2>
          <div class="dev-grid">
            <label>Brawling <input id="dev-brl" type="number" min="0" max="100"></label>
            <label>Technical <input id="dev-tec" type="number" min="0" max="100"></label>
            <label>Aerial <input id="dev-aer" type="number" min="0" max="100"></label>
            <label>Selling <input id="dev-sel" type="number" min="0" max="100"></label>
            <label>Psychology <input id="dev-psy" type="number" min="0" max="100"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Entertainment Stats</h2>
          <div class="dev-grid">
            <label>Charisma <input id="dev-cha" type="number" min="0" max="100"></label>
            <label>Mic Skills <input id="dev-mic" type="number" min="0" max="100"></label>
            <label>Acting <input id="dev-act" type="number" min="0" max="100"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Condition & Popularity</h2>
          <div class="dev-grid">
            <label>Health <input id="dev-health" type="number" min="0" max="100"></label>
            <label>Energy <input id="dev-energy" type="number" min="0" max="100"></label>
            <label>Mental Health <input id="dev-mental" type="number" min="0" max="100"></label>
            <label>Overness <input id="dev-overness" type="number" min="0" max="100"></label>
            <label>Momentum <input id="dev-momentum" type="number" min="0" max="100"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Financial</h2>
          <div class="dev-grid">
            <label>Bank Balance <input id="dev-bank" type="number" min="0"></label>
            <label>Weekly Expenses <input id="dev-expenses" type="number" min="0"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Contract</h2>
          <div class="dev-grid">
            <label>Promotion
              <select id="dev-promotion"></select>
            </label>
            <label>Weekly Salary <input id="dev-salary" type="number" min="0"></label>
            <label>Length Weeks <input id="dev-length" type="number" min="1"></label>
            <label>Remaining Weeks <input id="dev-remaining" type="number" min="0"></label>
            <label>Position <input id="dev-position" type="text" placeholder="opener"></label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Tags</h2>
          <div class="dev-grid">
            <label>Comma-separated tags
              <input id="dev-tags" type="text" placeholder="[Rookie], [Hot_Streak]">
            </label>
          </div>
        </section>

        <section class="dev-section">
          <h2>Game Saves</h2>
          <p class="dev-muted">View, edit, and create new saves from existing save files.</p>
          <div class="dev-grid">
            <button id="dev-refresh-all-saves" class="btn">Refresh All Saves</button>
          </div>
          <div id="dev-all-saves-list" class="dev-saves-list"></div>
        </section>

        <section class="dev-section">
          <h2>Save File Editor</h2>
          <p class="dev-muted">Select a save above to edit. Changes will be saved as a NEW file.</p>
          <div class="dev-grid">
            <label>Selected Save <span id="dev-edit-save-name" class="dev-muted">None</span></label>
            <label>New Save Name <input id="dev-new-save-name" type="text" placeholder="my-edited-save"></label>
          </div>
          <div id="dev-json-editor-container" class="dev-json-container">
            <div class="dev-json-toolbar">
              <button id="dev-editor-format" class="btn btn-small">Format</button>
              <button id="dev-editor-collapse" class="btn btn-small">Collapse All</button>
              <button id="dev-editor-expand" class="btn btn-small">Expand All</button>
              <button id="dev-editor-switch" class="btn btn-small">Switch to Raw</button>
            </div>
            <div id="dev-json-view" class="dev-json-view"></div>
            <textarea id="dev-save-editor" class="dev-textarea" rows="14" placeholder="Select a save to view its contents..." style="display: none;"></textarea>
          </div>
          <div class="dev-actions" style="margin-top: var(--space-sm);">
            <button id="dev-editor-refresh" class="btn">Reload from Save</button>
            <button id="dev-editor-validate" class="btn">Validate JSON</button>
            <button id="dev-editor-save-as" class="btn btn-primary">Save as New</button>
          </div>
          <div id="dev-editor-status" class="dev-editor-status"></div>
        </section>

        <section class="dev-section">
          <h2>Entity Editor</h2>
          <div class="dev-grid">
            <label>Entity
              <select id="dev-entity-select"></select>
            </label>
            <label>Tags (comma-separated)
              <input id="dev-entity-tags" type="text" placeholder="[Rookie], [Hot_Streak]">
            </label>
          </div>
          <div id="dev-entity-json-container" class="dev-json-container">
            <div class="dev-json-toolbar">
              <button id="dev-entity-format" class="btn btn-small">Format</button>
              <button id="dev-entity-collapse" class="btn btn-small">Collapse All</button>
              <button id="dev-entity-expand" class="btn btn-small">Expand All</button>
              <button id="dev-entity-switch" class="btn btn-small">Switch to Raw</button>
            </div>
            <div id="dev-entity-json-view" class="dev-json-view"></div>
            <textarea id="dev-entity-components" class="dev-textarea" rows="10" placeholder="{&quot;physicalStats&quot;:{...}}" style="display: none;"></textarea>
          </div>
          <div class="dev-actions" style="margin-top: var(--space-sm);">
            <button id="dev-entity-refresh" class="btn">Load Entity</button>
            <button id="dev-entity-apply" class="btn btn-primary">Apply Entity</button>
          </div>
        </section>

        <section class="dev-section">
          <h2>Raw State (Advanced)</h2>
          <p class="dev-muted">Edit the full serialized save state. Use with care.</p>
          <textarea id="dev-state-json" class="dev-textarea" rows="14" placeholder="{&quot;version&quot;:&quot;1.0.0&quot;,...}"></textarea>
          <div class="dev-actions" style="margin-top: var(--space-sm);">
            <button id="dev-state-refresh" class="btn">Load Current State</button>
            <button id="dev-state-apply" class="btn btn-primary">Apply State JSON</button>
          </div>
        </section>
      </div>
    `;

    this.statusEl = document.getElementById('dev-status');
    document.getElementById('dev-apply-btn')?.addEventListener('click', () => this.applyForm());
    document.getElementById('dev-apply-play-btn')?.addEventListener('click', () => this.applyAndPlay());
    document.getElementById('dev-save-btn')?.addEventListener('click', () => this.saveSnapshot());
    document.getElementById('dev-refresh-all-saves')?.addEventListener('click', () => this.refreshAllSaves());
    document.getElementById('dev-entity-refresh')?.addEventListener('click', () => this.loadSelectedEntity());
    document.getElementById('dev-entity-apply')?.addEventListener('click', () => this.applyEntity());
    document.getElementById('dev-state-refresh')?.addEventListener('click', () => this.loadRawState());
    document.getElementById('dev-state-apply')?.addEventListener('click', () => this.applyRawState());
    document.getElementById('dev-editor-refresh')?.addEventListener('click', () => this.reloadSaveToEditor());
    document.getElementById('dev-editor-validate')?.addEventListener('click', () => this.validateSaveJSON());
    document.getElementById('dev-editor-save-as')?.addEventListener('click', () => this.saveAsNew());
    document.getElementById('dev-editor-format')?.addEventListener('click', () => this.formatJSON());
    document.getElementById('dev-editor-collapse')?.addEventListener('click', () => this.collapseAllJSON());
    document.getElementById('dev-editor-expand')?.addEventListener('click', () => this.expandAllJSON());
    document.getElementById('dev-editor-switch')?.addEventListener('click', () => this.switchEditorMode());
    document.getElementById('dev-entity-refresh')?.addEventListener('click', () => this.loadSelectedEntity());
    document.getElementById('dev-entity-apply')?.addEventListener('click', () => this.applyEntity());
    document.getElementById('dev-entity-format')?.addEventListener('click', () => this.formatEntityJSON());
    document.getElementById('dev-entity-collapse')?.addEventListener('click', () => this.collapseAllEntityJSON());
    document.getElementById('dev-entity-expand')?.addEventListener('click', () => this.expandAllEntityJSON());
    document.getElementById('dev-entity-switch')?.addEventListener('click', () => this.switchEntityEditorMode());
  }

  ensureDevState() {
    let state = gameStateManager.getStateRef();
    let player = null;

    if (!state?.player?.entityId) {
      player = EntityFactory.createPlayerWrestler({
        name: 'Dev Wrestler',
        age: 25,
        hometown: 'Testville',
        gender: 'Male',
        gimmick: 'The Debugger',
        alignment: 'Face',
        catchphrase: '',
        entranceStyle: 'Simple',
        archetype: 'Technical',
        bonusPoints: {},
        mode: 'WRESTLER'
      });
      player.isPlayer = true;

      gameStateManager.initializeState({
        playerId: player.id,
        mode: 'WRESTLER',
        startYear: 1,
        startMonth: 1,
        startWeek: 1
      });

      gameStateManager.dispatch('ADD_ENTITY', { entity: player });
      state = gameStateManager.getStateRef();
    } else {
      player = state.entities.get(state.player.entityId);
    }

    if (state.promotions.size === 0) {
      AIPromotionSystem.generateInitialPromotions(state, 6);
    }

    this.ensurePromotionRosters(state);

    for (const promotion of state.promotions.values()) {
      ChampionshipSystem.initializePromotionChampionships(promotion);
    }

    this.ensurePlayerStartingContract(state, player);
  }

  ensurePromotionRosters(state) {
    for (const promotion of state.promotions.values()) {
      promotion.roster = promotion.roster || [];

      const hasRoster = promotion.roster.length > 0;
      if (!hasRoster && promotion.realData?.roster) {
        for (const wData of promotion.realData.roster) {
          const npc = EntityFactory.createNPCFromJSON({
            ...wData,
            hometown: promotion.region
          });
          gameStateManager.dispatch('ADD_ENTITY', { entity: npc });

          const contract = npc.getComponent('contract');
          if (contract) {
            contract.promotionId = promotion.id;
            contract.weeklySalary = 500 + ((wData.overness || 40) * 10);
            contract.lengthWeeks = 16;
            contract.remainingWeeks = 16;
          }

          promotion.roster.push(npc.id);
        }
      }

      const targetSize = promotion.prestige <= 15 ? 6 :
        promotion.prestige <= 40 ? 15 :
          promotion.prestige <= 70 ? 30 : 50;

      const needed = Math.max(0, targetSize - promotion.roster.length);

      for (let i = 0; i < needed; i++) {
        const npc = EntityFactory.generateRandomIndie(promotion.region);
        gameStateManager.dispatch('ADD_ENTITY', { entity: npc });

        const contract = npc.getComponent('contract');
        if (contract) {
          contract.promotionId = promotion.id;
          contract.weeklySalary = 50 + Math.floor(Math.random() * 150);
          contract.lengthWeeks = 16;
          contract.remainingWeeks = 16;
        }

        promotion.roster.push(npc.id);
      }
    }
  }

  ensurePlayerStartingContract(state, player) {
    if (!player) return;
    const contract = player.getComponent('contract');
    if (!contract || contract.promotionId) return;

    const promotions = Array.from(state.promotions.values());
    const indiePromo = promotions.find(p => p.prestige <= 20)
      || promotions.sort((a, b) => a.prestige - b.prestige)[0];

    if (!indiePromo) return;

    indiePromo.roster = indiePromo.roster || [];
    if (!indiePromo.roster.includes(player.id)) {
      indiePromo.roster.push(player.id);
    }

    contract.promotionId = indiePromo.id;
    contract.weeklySalary = 100;
    contract.lengthWeeks = 16;
    contract.remainingWeeks = 16;
    contract.position = 'opener';
  }

  populateForm() {
    const state = gameStateManager.getStateRef();
    if (!state?.player?.entityId) return;

    const player = state.entities.get(state.player.entityId);
    if (!player) return;

    const identity = player.getComponent('identity');
    const physical = player.getComponent('physicalStats');
    const inRing = player.getComponent('inRingStats');
    const entertainment = player.getComponent('entertainmentStats');
    const condition = player.getComponent('condition');
    const popularity = player.getComponent('popularity');
    const financial = player.getComponent('financial');
    const contract = player.getComponent('contract');

    this.setValue('dev-year', state.calendar.year);
    this.setValue('dev-month', state.calendar.month);
    this.setValue('dev-week', state.calendar.week);
    this.setValue('dev-day', state.calendar.day);

    this.setValue('dev-str', physical?.strength);
    this.setValue('dev-sta', physical?.stamina);
    this.setValue('dev-res', physical?.resilience);
    this.setValue('dev-spd', physical?.speed);

    this.setValue('dev-brl', inRing?.brawling);
    this.setValue('dev-tec', inRing?.technical);
    this.setValue('dev-aer', inRing?.aerial);
    this.setValue('dev-sel', inRing?.selling);
    this.setValue('dev-psy', inRing?.psychology);

    this.setValue('dev-cha', entertainment?.charisma);
    this.setValue('dev-mic', entertainment?.micSkills);
    this.setValue('dev-act', entertainment?.acting);

    this.setValue('dev-health', condition?.health);
    this.setValue('dev-energy', condition?.energy);
    this.setValue('dev-mental', condition?.mentalHealth);

    this.setValue('dev-overness', popularity?.overness);
    this.setValue('dev-momentum', popularity?.momentum);

    this.setValue('dev-bank', financial?.bankBalance);
    this.setValue('dev-expenses', financial?.weeklyExpenses);

    this.setValue('dev-salary', contract?.weeklySalary);
    this.setValue('dev-length', contract?.lengthWeeks);
    this.setValue('dev-remaining', contract?.remainingWeeks);
    this.setValue('dev-position', contract?.position || 'opener');

    const tagInput = document.getElementById('dev-tags');
    if (tagInput && player.tags?.size) {
      tagInput.value = Array.from(player.tags).join(', ');
    }

    this.populatePromotionSelect(state, contract?.promotionId);
    if (identity) {
      this.showStatus(`Loaded state for ${identity.name}.`, true);
    }
  }

  populatePromotionSelect(state, selectedId) {
    const select = document.getElementById('dev-promotion');
    if (!select) return;
    select.innerHTML = '<option value="">Free Agent</option>';
    for (const promotion of state.promotions.values()) {
      const opt = document.createElement('option');
      opt.value = promotion.id;
      opt.textContent = `${promotion.name} (${promotion.region})`;
      if (selectedId && promotion.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    }
  }

  applyForm() {
    const state = gameStateManager.getStateRef();
    if (!state?.player?.entityId) return false;

    const player = state.entities.get(state.player.entityId);
    if (!player) return false;

    const physical = player.getComponent('physicalStats');
    const inRing = player.getComponent('inRingStats');
    const entertainment = player.getComponent('entertainmentStats');
    const condition = player.getComponent('condition');
    const popularity = player.getComponent('popularity');
    const financial = player.getComponent('financial');
    const contract = player.getComponent('contract');

    Object.assign(state.calendar, {
      year: this.getNumber('dev-year', state.calendar.year),
      month: this.getNumber('dev-month', state.calendar.month),
      week: this.getNumber('dev-week', state.calendar.week),
      day: this.getNumber('dev-day', state.calendar.day)
    });

    if (physical) {
      physical.strength = this.getNumber('dev-str', physical.strength);
      physical.stamina = this.getNumber('dev-sta', physical.stamina);
      physical.resilience = this.getNumber('dev-res', physical.resilience);
      physical.speed = this.getNumber('dev-spd', physical.speed);
    }

    if (inRing) {
      inRing.brawling = this.getNumber('dev-brl', inRing.brawling);
      inRing.technical = this.getNumber('dev-tec', inRing.technical);
      inRing.aerial = this.getNumber('dev-aer', inRing.aerial);
      inRing.selling = this.getNumber('dev-sel', inRing.selling);
      inRing.psychology = this.getNumber('dev-psy', inRing.psychology);
    }

    if (entertainment) {
      entertainment.charisma = this.getNumber('dev-cha', entertainment.charisma);
      entertainment.micSkills = this.getNumber('dev-mic', entertainment.micSkills);
      entertainment.acting = this.getNumber('dev-act', entertainment.acting);
    }

    if (condition) {
      condition.health = this.getNumber('dev-health', condition.health);
      condition.energy = this.getNumber('dev-energy', condition.energy);
      condition.mentalHealth = this.getNumber('dev-mental', condition.mentalHealth);
    }

    if (popularity) {
      popularity.overness = this.getNumber('dev-overness', popularity.overness);
      popularity.momentum = this.getNumber('dev-momentum', popularity.momentum);
    }

    if (financial) {
      financial.bankBalance = this.getNumber('dev-bank', financial.bankBalance);
      financial.weeklyExpenses = this.getNumber('dev-expenses', financial.weeklyExpenses);
    }

    if (contract) {
      const promotionId = document.getElementById('dev-promotion')?.value || null;
      contract.promotionId = promotionId || null;
      contract.weeklySalary = this.getNumber('dev-salary', contract.weeklySalary);
      contract.lengthWeeks = this.getNumber('dev-length', contract.lengthWeeks || 52);
      contract.remainingWeeks = this.getNumber('dev-remaining', contract.remainingWeeks || 52);
      contract.position = document.getElementById('dev-position')?.value || contract.position || 'opener';

      for (const promotion of state.promotions.values()) {
        promotion.roster = (promotion.roster || []).filter(id => id !== player.id);
      }
      if (promotionId) {
        const promotion = state.promotions.get(promotionId);
        if (promotion) {
          promotion.roster = promotion.roster || [];
          if (!promotion.roster.includes(player.id)) {
            promotion.roster.push(player.id);
          }
        }
      }
    }

    const tagInput = document.getElementById('dev-tags')?.value?.trim();
    if (tagInput) {
      player.tags.clear();
      tagInput.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => player.tags.add(tag));
    }

    this.showStatus('State applied.', true);
    return true;
  }

  applyAndPlay() {
    const success = this.applyForm();
    if (!success) {
      this.showStatus('Could not apply state for play mode.', false);
      return;
    }

    uiManager.showScreen('game-screen');
  }

  async saveSnapshot() {
    const name = document.getElementById('dev-save-name')?.value?.trim();
    const keySuffix = name || `snapshot_${Date.now()}`;
    const key = `mat_life_save_dev_${keySuffix}`;
    const success = await saveLoadManager.saveAs(key);
    this.showStatus(success ? `Saved snapshot: ${keySuffix}` : 'Failed to save snapshot.', success);
    if (success) {
      this.refreshAllSaves();
    }
  }

  refreshEntityList() {
    const select = document.getElementById('dev-entity-select');
    const state = gameStateManager.getStateRef();
    if (!select || !state) return;

    select.innerHTML = '';
    for (const entity of state.entities.values()) {
      const identity = entity.getComponent('identity');
      const label = identity?.name ? `${identity.name} (${entity.id})` : entity.id;
      const opt = document.createElement('option');
      opt.value = entity.id;
      opt.textContent = label;
      select.appendChild(opt);
    }

    if (select.options.length > 0) {
      this.loadSelectedEntity();
    }
  }

  loadSelectedEntity() {
    const select = document.getElementById('dev-entity-select');
    const state = gameStateManager.getStateRef();
    if (!select || !state) return;

    const entity = state.entities.get(select.value);
    if (!entity) return;

    const tagsEl = document.getElementById('dev-entity-tags');
    if (tagsEl) {
      tagsEl.value = Array.from(entity.tags || []).join(', ');
    }

    const componentsEl = document.getElementById('dev-entity-components');
    const components = this.serializeComponents(entity.components);
    this.selectedEntityData = components;
    
    if (componentsEl) {
      componentsEl.value = JSON.stringify(components, null, 2);
    }

    this.entityEditorMode = 'view';
    const viewEl = document.getElementById('dev-entity-json-view');
    const switchBtn = document.getElementById('dev-entity-switch');
    if (viewEl) {
      viewEl.style.display = 'block';
      if (componentsEl) componentsEl.style.display = 'none';
      if (switchBtn) switchBtn.textContent = 'Switch to Raw';
    }
    
    this.renderEntityJSONView(components);
  }

  applyEntity() {
    const select = document.getElementById('dev-entity-select');
    const state = gameStateManager.getStateRef();
    if (!select || !state) return;

    const entity = state.entities.get(select.value);
    if (!entity) return;

    const tagsEl = document.getElementById('dev-entity-tags');

    let data;
    if (this.entityEditorMode === 'view' && this.selectedEntityData) {
      data = this.selectedEntityData;
    } else {
      const componentsEl = document.getElementById('dev-entity-components');
      if (!componentsEl?.value?.trim()) {
        this.showStatus('No components data to apply.', false);
        return;
      }
      try {
        data = JSON.parse(componentsEl.value);
      } catch (error) {
        this.showStatus('Invalid JSON in components editor.', false);
        return;
      }
    }

    for (const [name, payload] of Object.entries(data)) {
      try {
        const component = deserializeComponent(name, payload);
        entity.components.set(name, component);
      } catch (error) {
        const existing = entity.components.get(name);
        if (existing && typeof existing === 'object') {
          Object.assign(existing, payload);
        } else {
          entity.components.set(name, payload);
        }
      }
    }

    if (tagsEl) {
      entity.tags.clear();
      tagsEl.value.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => entity.tags.add(tag));
    }

    this.showStatus('Entity updated.', true);
    this.populateForm();
  }

  loadRawState() {
    const textarea = document.getElementById('dev-state-json');
    if (!textarea) return;
    const data = saveLoadManager.serializeState();
    textarea.value = JSON.stringify(data, null, 2);
    this.showStatus('Loaded current state JSON.', true);
  }

  applyRawState() {
    const textarea = document.getElementById('dev-state-json');
    if (!textarea || !textarea.value.trim()) return;
    try {
      const data = JSON.parse(textarea.value);
      const success = saveLoadManager.deserializeState(data);
      if (success) {
        this.populateForm();
        this.refreshEntityList();
        this.showStatus('State JSON applied.', true);
      } else {
        this.showStatus('Failed to apply state JSON.', false);
      }
    } catch (error) {
      this.showStatus('Invalid JSON in state editor.', false);
    }
  }

  async refreshAllSaves() {
    const list = document.getElementById('dev-all-saves-list');
    if (!list || typeof localforage === 'undefined') return;

    const allKeys = await localforage.keys();
    const gameSaveKeys = allKeys.filter(k => 
      k.startsWith('mat_life_save_') && k !== 'mat_life_save_slots'
    );

    if (gameSaveKeys.length === 0) {
      list.innerHTML = '<p class="dev-muted">No game saves found.</p>';
      return;
    }

    const items = await Promise.all(gameSaveKeys.map(async key => {
      const data = await localforage.getItem(key);
      return { key, data };
    }));

    list.innerHTML = items.map(item => {
      const isDev = item.key.startsWith('mat_life_save_dev_');
      const label = item.data?.player?.name || item.data?.playerName || 'Unknown';
      const date = item.data?.saveDate ? new Date(item.data.saveDate).toLocaleString() : 'Unknown date';
      const shortKey = item.key.replace('mat_life_save_', '').replace('mat_life_save_dev_', '');
      const year = item.data?.calendar?.year || '?';
      const week = item.data?.calendar?.week || '?';
      const month = item.data?.calendar?.month || '?';
      return `
        <div class="dev-save-item">
          <div>
            <strong>${shortKey}</strong>
            <span class="dev-badge">${isDev ? 'Dev' : 'Save'}</span>
            <div class="dev-muted">${label} · Week ${week}, Month ${month}, Year ${year} · ${date}</div>
          </div>
          <div class="dev-save-actions">
            <button class="btn btn-small" data-dev-edit="${item.key}">Edit</button>
            <button class="btn btn-small" data-dev-load="${item.key}">Load</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-dev-edit]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.currentTarget.getAttribute('data-dev-edit');
        await this.loadSaveForEditing(key);
      });
    });

    list.querySelectorAll('[data-dev-load]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.currentTarget.getAttribute('data-dev-load');
        const success = await saveLoadManager.loadAs(key);
        if (success) {
          uiManager.showScreen('game-screen');
          uiManager.render(gameStateManager.getStateRef());
          this.showStatus(`Loaded save: ${key.replace('mat_life_save_', '').replace('mat_life_save_dev_', '')}`, true);
        } else {
          this.showStatus('Failed to load save.', false);
        }
      });
    });
  }

  async loadSaveForEditing(key) {
    if (typeof localforage === 'undefined') return;
    
    const data = await localforage.getItem(key);
    if (!data) {
      this.showEditorStatus('Save not found.', false);
      return;
    }

    this.selectedSaveKey = key;
    this.selectedSaveData = data;
    
    const nameEl = document.getElementById('dev-edit-save-name');
    const editorEl = document.getElementById('dev-save-editor');
    const newNameEl = document.getElementById('dev-new-save-name');
    
    if (nameEl) {
      const shortName = key.replace('mat_life_save_', '').replace('mat_life_save_dev_', '');
      nameEl.textContent = shortName;
    }
    
    if (editorEl) {
      editorEl.value = JSON.stringify(data, null, 2);
    }
    
    if (newNameEl) {
      newNameEl.value = '';
    }

    this.jsonEditorMode = 'view';
    const viewEl = document.getElementById('dev-json-view');
    const switchBtn = document.getElementById('dev-editor-switch');
    if (viewEl) {
      viewEl.style.display = 'block';
      if (editorEl) editorEl.style.display = 'none';
      if (switchBtn) switchBtn.textContent = 'Switch to Raw';
    }
    
    this.renderJSONView(data);
    this.showEditorStatus('Loaded save for editing. Edit JSON below and save as new.', true);
  }

  async reloadSaveToEditor() {
    if (!this.selectedSaveKey) {
      this.showEditorStatus('No save selected.', false);
      return;
    }
    await this.loadSaveForEditing(this.selectedSaveKey);
  }

  validateSaveJSON() {
    let data;
    
    if (this.jsonEditorMode === 'view' && this.selectedSaveData) {
      data = this.selectedSaveData;
    } else {
      const editorEl = document.getElementById('dev-save-editor');
      if (!editorEl || !editorEl.value.trim()) {
        this.showEditorStatus('Editor is empty.', false);
        return;
      }
      try {
        data = JSON.parse(editorEl.value);
      } catch (error) {
        this.showEditorStatus(`Invalid JSON: ${error.message}`, false);
        return;
      }
    }

    const validation = this.validateSaveData(data);
    if (validation.valid) {
      this.showEditorStatus(`Valid save file! ${validation.message}`, true);
    } else {
      this.showEditorStatus(`Warning: ${validation.message}`, false);
    }
  }

  validateSaveData(data) {
    const errors = [];
    const warnings = [];

    if (!data) {
      return { valid: false, message: 'Save data is null or undefined' };
    }

    if (!data.version) {
      errors.push('Missing version field');
    }

    if (!data.calendar) {
      errors.push('Missing calendar data');
    } else {
      const cal = data.calendar;
      if (typeof cal.year !== 'number' || cal.year < 1) {
        errors.push('Invalid calendar year');
      }
      if (typeof cal.month !== 'number' || cal.month < 1 || cal.month > 12) {
        warnings.push('Invalid calendar month (should be 1-12)');
      }
      if (typeof cal.week !== 'number' || cal.week < 1) {
        warnings.push('Invalid calendar week');
      }
    }

    if (!data.player) {
      errors.push('Missing player data');
    }

    if (!data.entities || !Array.isArray(data.entities)) {
      warnings.push('Entities not found or not an array');
    }

    if (!data.promotions || !Array.isArray(data.promotions)) {
      warnings.push('Promotions not found or not an array');
    }

    if (errors.length > 0) {
      return { valid: false, message: errors.join(', ') };
    }

    if (warnings.length > 0) {
      return { valid: true, message: `Valid with warnings: ${warnings.join(', ')}` };
    }

    const entityCount = data.entities?.length || 0;
    const promoCount = data.promotions?.length || 0;
    return { valid: true, message: `Valid save with ${entityCount} entities, ${promoCount} promotions` };
  }

  async saveAsNew() {
    const newNameEl = document.getElementById('dev-new-save-name');
    
    const newName = newNameEl?.value?.trim();
    if (!newName) {
      this.showEditorStatus('Please enter a name for the new save.', false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      this.showEditorStatus('Save name can only contain letters, numbers, underscores, and hyphens.', false);
      return;
    }

    let data;
    
    if (this.jsonEditorMode === 'view' && this.selectedSaveData) {
      data = this.selectedSaveData;
    } else {
      const editorEl = document.getElementById('dev-save-editor');
      if (!editorEl || !editorEl.value.trim()) {
        this.showEditorStatus('Editor is empty. Nothing to save.', false);
        return;
      }
      try {
        data = JSON.parse(editorEl.value);
      } catch (error) {
        this.showEditorStatus(`Invalid JSON: ${error.message}`, false);
        return;
      }
    }

    const validation = this.validateSaveData(data);
    if (!validation.valid) {
      this.showEditorStatus(`Cannot save: ${validation.message}`, false);
      return;
    }

    const key = `mat_life_save_dev_${newName}_${Date.now()}`;
    
    try {
      await localforage.setItem(key, data);
      this.showEditorStatus(`Saved as new file: ${newName}`, true);
      this.refreshAllSaves();
    } catch (error) {
      this.showEditorStatus(`Failed to save: ${error.message}`, false);
    }
  }

  showEditorStatus(message, success) {
    const statusEl = document.getElementById('dev-editor-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `dev-editor-status ${success ? 'dev-status-success' : 'dev-status-error'}`;
  }

  formatJSON() {
    const editorEl = document.getElementById('dev-save-editor');
    if (!editorEl?.value.trim()) {
      this.showEditorStatus('No JSON to format.', false);
      return;
    }
    try {
      const data = JSON.parse(editorEl.value);
      editorEl.value = JSON.stringify(data, null, 2);
      this.renderJSONView(data);
      this.showEditorStatus('JSON formatted.', true);
    } catch (error) {
      this.showEditorStatus(`Invalid JSON: ${error.message}`, false);
    }
  }

  switchEditorMode() {
    const viewEl = document.getElementById('dev-json-view');
    const editorEl = document.getElementById('dev-save-editor');
    const switchBtn = document.getElementById('dev-editor-switch');
    
    if (this.jsonEditorMode === 'view') {
      this.jsonEditorMode = 'raw';
      viewEl.style.display = 'none';
      editorEl.style.display = 'block';
      switchBtn.textContent = 'Switch to Viewer';
      if (this.selectedSaveData) {
        editorEl.value = JSON.stringify(this.selectedSaveData, null, 2);
      }
    } else {
      this.jsonEditorMode = 'view';
      viewEl.style.display = 'block';
      editorEl.style.display = 'none';
      switchBtn.textContent = 'Switch to Raw';
      if (editorEl.value.trim()) {
        try {
          const data = JSON.parse(editorEl.value);
          this.selectedSaveData = data;
          this.renderJSONView(data);
        } catch (e) {
          this.showEditorStatus('Cannot switch: Invalid JSON in editor.', false);
          return;
        }
      }
    }
  }

  renderJSONView(data, indent = 0) {
    const viewEl = document.getElementById('dev-json-view');
    if (!viewEl) return;
    
    viewEl.innerHTML = '';
    viewEl.appendChild(this.createEditableJSONNode(data, 'root', indent, 'save'));
  }

  createJSONNode(data, key, indent) {
    const container = document.createElement('div');
    container.className = 'dev-json-node';
    container.style.paddingLeft = `${indent * 20}px`;

    if (data === null) {
      container.innerHTML = `<span class="dev-json-key">${key}:</span> <span class="dev-json-null">null</span>`;
      return container;
    }

    if (typeof data !== 'object') {
      const type = typeof data;
      let valueClass = 'dev-json-string';
      if (type === 'number') valueClass = 'dev-json-number';
      else if (type === 'boolean') valueClass = 'dev-json-boolean';
      
      const displayKey = key !== 'root' ? `<span class="dev-json-key">${key}:</span> ` : '';
      container.innerHTML = `${displayKey}<span class="${valueClass}">${JSON.stringify(data)}</span>`;
      return container;
    }

    const isArray = Array.isArray(data);
    const isEmpty = Object.keys(data).length === 0;
    const nodeId = `json_${Math.random().toString(36).substr(2, 9)}`;
    
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'dev-json-toggle';
    toggleBtn.textContent = isEmpty ? (isArray ? '[]' : '{}') : (isArray ? '[' : '{');
    toggleBtn.dataset.nodeId = nodeId;
    toggleBtn.dataset.collapsed = 'false';
    
    if (!isEmpty) {
      toggleBtn.addEventListener('click', (e) => {
        const id = e.target.dataset.nodeId;
        const isCollapsed = e.target.dataset.collapsed === 'true';
        const children = document.getElementById(id);
        if (children) {
          children.style.display = isCollapsed ? 'block' : 'none';
          e.target.dataset.collapsed = (!isCollapsed).toString();
          e.target.textContent = isCollapsed ? (isArray ? '[' : '{') : (isArray ? '[...]' : '{...}');
        }
      });
    }

    const keySpan = key !== 'root' ? `<span class="dev-json-key">${key}:</span> ` : '';
    container.innerHTML = `${keySpan}`;
    container.insertBefore(toggleBtn, container.firstChild);

    if (!isEmpty) {
      const children = document.createElement('div');
      children.id = nodeId;
      children.className = 'dev-json-children';
      
      const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
      for (const [k, v] of entries) {
        children.appendChild(this.createJSONNode(v, isArray ? '' : k, indent + 1));
      }
      
      const closeBracket = document.createElement('div');
      closeBracket.style.paddingLeft = `${indent * 20}px`;
      closeBracket.textContent = isArray ? ']' : '}';
      closeBracket.className = 'dev-json-close';
      children.appendChild(closeBracket);
      
      container.appendChild(children);
    } else {
      const closeBracket = document.createElement('span');
      closeBracket.textContent = isArray ? ']' : '}';
      closeBracket.className = 'dev-json-close';
      container.appendChild(closeBracket);
    }

    return container;
  }

  collapseAllJSON() {
    document.querySelectorAll('.dev-json-toggle').forEach(btn => {
      if (btn.textContent === '[' || btn.textContent === '{') {
        btn.click();
      }
    });
  }

  expandAllJSON() {
    document.querySelectorAll('.dev-json-toggle[data-collapsed="true"]').forEach(btn => {
      btn.click();
    });
  }

  formatEntityJSON() {
    const editorEl = document.getElementById('dev-entity-components');
    if (!editorEl?.value.trim()) {
      this.showStatus('No JSON to format.', false);
      return;
    }
    try {
      const data = JSON.parse(editorEl.value);
      editorEl.value = JSON.stringify(data, null, 2);
      this.renderEntityJSONView(data);
      this.showStatus('JSON formatted.', true);
    } catch (error) {
      this.showStatus(`Invalid JSON: ${error.message}`, false);
    }
  }

  switchEntityEditorMode() {
    const viewEl = document.getElementById('dev-entity-json-view');
    const editorEl = document.getElementById('dev-entity-components');
    const switchBtn = document.getElementById('dev-entity-switch');
    
    if (this.entityEditorMode === 'view') {
      this.entityEditorMode = 'raw';
      viewEl.style.display = 'none';
      editorEl.style.display = 'block';
      switchBtn.textContent = 'Switch to Viewer';
      if (this.selectedEntityData) {
        editorEl.value = JSON.stringify(this.selectedEntityData, null, 2);
      }
    } else {
      this.entityEditorMode = 'view';
      viewEl.style.display = 'block';
      editorEl.style.display = 'none';
      switchBtn.textContent = 'Switch to Raw';
      if (editorEl.value.trim()) {
        try {
          const data = JSON.parse(editorEl.value);
          this.selectedEntityData = data;
          this.renderEntityJSONView(data);
        } catch (e) {
          this.showStatus('Cannot switch: Invalid JSON in editor.', false);
          return;
        }
      }
    }
  }

  renderEntityJSONView(data) {
    const viewEl = document.getElementById('dev-entity-json-view');
    if (!viewEl) return;
    
    viewEl.innerHTML = '';
    viewEl.appendChild(this.createEditableJSONNode(data, 'root', 0, 'entity'));
  }

  createEditableJSONNode(data, key, indent, editorType) {
    const container = document.createElement('div');
    container.className = 'dev-json-node';
    container.style.paddingLeft = `${indent * 20}px`;

    if (data === null) {
      container.innerHTML = `<span class="dev-json-key">${key}:</span> <span class="dev-json-null dev-json-editable" data-key="${key}" data-editor="${editorType}">null</span>`;
      this.addEditableListener(container.querySelector('.dev-json-editable'), key, null, editorType);
      return container;
    }

    if (typeof data !== 'object') {
      const type = typeof data;
      let valueClass = 'dev-json-string';
      if (type === 'number') valueClass = 'dev-json-number';
      else if (type === 'boolean') valueClass = 'dev-json-boolean';
      
      const displayKey = key !== 'root' ? `<span class="dev-json-key">${key}:</span> ` : '';
      container.innerHTML = `${displayKey}<span class="${valueClass} dev-json-editable" data-key="${key}" data-editor="${editorType}">${JSON.stringify(data)}</span>`;
      this.addEditableListener(container.querySelector('.dev-json-editable'), key, data, editorType);
      return container;
    }

    const isArray = Array.isArray(data);
    const isEmpty = Object.keys(data).length === 0;
    const nodeId = `json_${Math.random().toString(36).substr(2, 9)}`;
    
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'dev-json-toggle';
    toggleBtn.textContent = isEmpty ? (isArray ? '[]' : '{}') : (isArray ? '[' : '{');
    toggleBtn.dataset.nodeId = nodeId;
    toggleBtn.dataset.collapsed = 'false';
    
    if (!isEmpty) {
      toggleBtn.addEventListener('click', (e) => {
        const id = e.target.dataset.nodeId;
        const isCollapsed = e.target.dataset.collapsed === 'true';
        const children = document.getElementById(id);
        if (children) {
          children.style.display = isCollapsed ? 'block' : 'none';
          e.target.dataset.collapsed = (!isCollapsed).toString();
          e.target.textContent = isCollapsed ? (isArray ? '[' : '{') : (isArray ? '[...]' : '{...}');
        }
      });
    }

    const keySpan = key !== 'root' ? `<span class="dev-json-key">${key}:</span> ` : '';
    container.innerHTML = `${keySpan}`;
    container.insertBefore(toggleBtn, container.firstChild);

    if (!isEmpty) {
      const children = document.createElement('div');
      children.id = nodeId;
      children.className = 'dev-json-children';
      
      const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
      for (const [k, v] of entries) {
        children.appendChild(this.createEditableJSONNode(v, isArray ? '' : k, indent + 1, editorType));
      }
      
      const closeBracket = document.createElement('div');
      closeBracket.style.paddingLeft = `${indent * 20}px`;
      closeBracket.textContent = isArray ? ']' : '}';
      closeBracket.className = 'dev-json-close';
      children.appendChild(closeBracket);
      
      container.appendChild(children);
    } else {
      const closeBracket = document.createElement('span');
      closeBracket.textContent = isArray ? ']' : '}';
      closeBracket.className = 'dev-json-close';
      container.appendChild(closeBracket);
    }

    return container;
  }

  addEditableListener(el, key, value, editorType) {
    el.addEventListener('click', (e) => {
      if (el.querySelector('input')) return;
      
      const currentValue = value === null ? 'null' : JSON.stringify(value).slice(1, -1);
      el.innerHTML = `<input type="text" class="dev-json-input" value="${currentValue}" data-original='${JSON.stringify(value)}'>`;
      const input = el.querySelector('input');
      input.focus();
      input.select();

      const finishEdit = (save) => {
        const newVal = input.value;
        const original = JSON.parse(input.dataset.original);
        
        if (save && newVal !== currentValue) {
          let parsed;
          try {
            if (newVal === 'null') parsed = null;
            else if (newVal === 'true') parsed = true;
            else if (newVal === 'false') parsed = false;
            else if (/^-?\d+$/.test(newVal)) parsed = parseInt(newVal, 10);
            else if (/^-?\d+\.\d+$/.test(newVal)) parsed = parseFloat(newVal);
            else if ((newVal.startsWith('"') && newVal.endsWith('"')) || (newVal.startsWith("'") && newVal.endsWith("'"))) {
              parsed = newVal.slice(1, -1);
            } else {
              parsed = newVal;
            }
            
            this.updateJSONData(editorType, key, parsed);
            
            if (parsed === null) {
              el.innerHTML = `<span class="dev-json-null">null</span>`;
            } else if (typeof parsed === 'string') {
              el.innerHTML = `<span class="dev-json-string">"${parsed}"</span>`;
            } else if (typeof parsed === 'number') {
              el.innerHTML = `<span class="dev-json-number">${parsed}</span>`;
            } else if (typeof parsed === 'boolean') {
              el.innerHTML = `<span class="dev-json-boolean">${parsed}</span>`;
            }
          } catch (err) {
            this.restoreDisplay(el, original);
          }
        } else {
          this.restoreDisplay(el, original);
        }
      };

      input.addEventListener('blur', () => finishEdit(true));
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') finishEdit(true);
        if (ev.key === 'Escape') finishEdit(false);
      });
    });
  }

  restoreDisplay(el, value) {
    if (value === null) {
      el.innerHTML = '<span class="dev-json-null">null</span>';
    } else if (typeof value === 'string') {
      el.innerHTML = `<span class="dev-json-string">"${value}"</span>`;
    } else if (typeof value === 'number') {
      el.innerHTML = `<span class="dev-json-number">${value}</span>`;
    } else if (typeof value === 'boolean') {
      el.innerHTML = `<span class="dev-json-boolean">${value}</span>`;
    }
  }

  updateJSONData(editorType, key, newValue) {
    if (editorType === 'save') {
      this.selectedSaveData[key] = newValue;
    } else if (editorType === 'entity') {
      this.selectedEntityData[key] = newValue;
    }
  }

  collapseAllEntityJSON() {
    document.querySelectorAll('#dev-entity-json-view .dev-json-toggle').forEach(btn => {
      if (btn.textContent === '[' || btn.textContent === '{') {
        btn.click();
      }
    });
  }

  expandAllEntityJSON() {
    document.querySelectorAll('#dev-entity-json-view .dev-json-toggle[data-collapsed="true"]').forEach(btn => {
      btn.click();
    });
  }

  serializeComponents(components) {
    const serialized = {};
    for (const [name, component] of components) {
      if (component && typeof component.serialize === 'function') {
        serialized[name] = component.serialize();
      } else {
        serialized[name] = { ...component };
      }
    }
    return serialized;
  }

  setValue(id, value) {
    const el = document.getElementById(id);
    if (el && value != null) {
      el.value = value;
    }
  }

  getNumber(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const parsed = Number(el.value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  showStatus(message, success) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.className = `dev-status ${success ? 'dev-status-success' : 'dev-status-error'}`;
  }
}

export default DevPanel;
