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
  }

  init() {
    if (!this.container) return;
    this.buildUI();
    this.ensureDevState();
    this.populateForm();
    this.refreshEntityList();
    this.refreshSaveList();
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
          <h2>Dev Saves</h2>
          <div class="dev-grid">
            <label>Snapshot Name <input id="dev-save-name" type="text" placeholder="my-test-save"></label>
            <button id="dev-refresh-saves" class="btn">Refresh List</button>
          </div>
          <div id="dev-saves-list" class="dev-saves-list"></div>
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
          <label style="display:block; margin-top: var(--space-sm);">Components JSON</label>
          <textarea id="dev-entity-components" class="dev-textarea" rows="10" placeholder="{&quot;physicalStats&quot;:{...}}"></textarea>
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
    document.getElementById('dev-refresh-saves')?.addEventListener('click', () => this.refreshSaveList());
    document.getElementById('dev-entity-refresh')?.addEventListener('click', () => this.loadSelectedEntity());
    document.getElementById('dev-entity-apply')?.addEventListener('click', () => this.applyEntity());
    document.getElementById('dev-state-refresh')?.addEventListener('click', () => this.loadRawState());
    document.getElementById('dev-state-apply')?.addEventListener('click', () => this.applyRawState());
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
      this.refreshSaveList();
    }
  }

  async refreshSaveList() {
    const list = document.getElementById('dev-saves-list');
    if (!list || typeof localforage === 'undefined') return;

    const keys = (await localforage.keys()).filter(k => k.startsWith('mat_life_save_dev_'));
    if (keys.length === 0) {
      list.innerHTML = '<p class="dev-muted">No dev saves found.</p>';
      return;
    }

    const items = await Promise.all(keys.map(async key => {
      const data = await localforage.getItem(key);
      return { key, data };
    }));

    list.innerHTML = items.map(item => {
      const label = item.data?.player?.name || 'Unknown';
      const date = item.data?.saveDate ? new Date(item.data.saveDate).toLocaleString() : 'Unknown date';
      const shortKey = item.key.replace('mat_life_save_dev_', '');
      return `
        <div class="dev-save-item">
          <div>
            <strong>${shortKey}</strong>
            <div class="dev-muted">${label} · ${date}</div>
          </div>
          <button class="btn btn-small" data-dev-load="${item.key}">Load</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-dev-load]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const key = e.currentTarget.getAttribute('data-dev-load');
        const success = await saveLoadManager.loadAs(key);
        if (success) {
          this.populateForm();
          this.showStatus(`Loaded snapshot: ${key.replace('mat_life_save_dev_', '')}`, true);
        } else {
          this.showStatus('Failed to load snapshot.', false);
        }
      });
    });
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
    if (componentsEl) {
      const components = this.serializeComponents(entity.components);
      componentsEl.value = JSON.stringify(components, null, 2);
    }
  }

  applyEntity() {
    const select = document.getElementById('dev-entity-select');
    const state = gameStateManager.getStateRef();
    if (!select || !state) return;

    const entity = state.entities.get(select.value);
    if (!entity) return;

    const componentsEl = document.getElementById('dev-entity-components');
    const tagsEl = document.getElementById('dev-entity-tags');

    if (componentsEl?.value?.trim()) {
      try {
        const data = JSON.parse(componentsEl.value);
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
      } catch (error) {
        this.showStatus('Invalid JSON in components editor.', false);
        return;
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
