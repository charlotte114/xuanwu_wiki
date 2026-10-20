(function () {
  var DATA = window.PANEL_ATTACK_DATA;
  if (!DATA) return;

  var BASE = DATA.baseAttackConst || 1569;

  function $(id) {
    return document.getElementById(id);
  }

  function floor(n) {
    return Math.floor(n);
  }

  function round(n) {
    return Math.round(n);
  }

  function fillSelect(sel, items, labelKey, valueKey) {
    if (!sel) return;
    var html = '<option value="">— 请选择 —</option>';
    items.forEach(function (it, i) {
      var label = it[labelKey];
      var extra = valueKey && it[valueKey] != null ? " (" + it[valueKey] + ")" : "";
      html +=
        '<option value="' + i + '">' + escapeHtml(String(label) + extra) + "</option>";
    });
    sel.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function num(id, def) {
    var el = $(id);
    if (!el) return def || 0;
    var v = parseFloat(el.value);
    return isNaN(v) ? def || 0 : v;
  }

  function selectedItem(sel, list) {
    if (!sel || sel.value === "") return null;
    var i = parseInt(sel.value, 10);
    return list[i] || null;
  }

  function findByName(list, name) {
    if (!name) return null;
    var q = String(name).trim();
    if (!q) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === q) return list[i];
    }
    return null;
  }

  function resolveComboItem(hiddenId, inputId, list) {
    var picked = selectedItem($(hiddenId), list);
    if (picked) return picked;
    return findByName(list, $(inputId) && $(inputId).value);
  }

  function weaponAttackPct(wep) {
    if (!wep || wep.attackPct == null) return 0;
    return wep.attackPct;
  }

  var ATTR_ATTACK_FLAT = 65536;
  var ATTR_ATTACK_PCT = 131072;
  var ATTR_CRIT_DMG_PCT = 16777216;

  function weaponForgeBonusFromDom() {
    var bonus = { atk: 0, pct: 0, crit: 0 };
    document.querySelectorAll(".panel-calc-forge-option.is-selected").forEach(function (li) {
      var code = parseInt(li.getAttribute("data-code"), 10);
      var val = parseFloat(li.getAttribute("data-value"));
      if (isNaN(val)) return;
      if (code === ATTR_ATTACK_FLAT) bonus.atk += val;
      else if (code === ATTR_ATTACK_PCT) bonus.pct += val;
      else if (code === ATTR_CRIT_DMG_PCT) bonus.crit += val / 100;
    });
    return bonus;
  }

  var activeWeaponForForge = null;
  var weaponForgeComboBound = false;

  function syncWeaponStatsWithForge(wep) {
    var base = wep || activeWeaponForForge;
    if (!base) return;
    var bonus = weaponForgeBonusFromDom();
    $("paWeaponAtk").value = base.attack + bonus.atk;
    $("paWeaponPct").value = weaponAttackPct(base) + bonus.pct;
    $("paWeaponCrit").value = (base.critDmg || 0) + bonus.crit;
  }

  function updateWeaponForgeSummary() {
    var input = $("paWeaponForgeInput");
    if (!input) return;
    var labels = [];
    document.querySelectorAll(".panel-calc-forge-option.is-selected").forEach(function (li) {
      var nameEl = li.querySelector(".panel-calc-combo-option-name");
      if (nameEl) labels.push(nameEl.textContent);
    });
    input.value = labels.length ? labels[0] : "";
    input.placeholder = labels.length ? "" : "点击选择可锻造属性…";
  }

  function closeWeaponForgeList() {
    var list = $("paWeaponForgeList");
    var input = $("paWeaponForgeInput");
    if (list) list.hidden = true;
    if (input) input.setAttribute("aria-expanded", "false");
  }

  function openWeaponForgeList() {
    var list = $("paWeaponForgeList");
    var input = $("paWeaponForgeInput");
    if (!list || list.hidden === false) return;
    if (!list.querySelector(".panel-calc-forge-option")) return;
    list.hidden = false;
    if (input) input.setAttribute("aria-expanded", "true");
  }

  function bindWeaponForgeCombo() {
    if (weaponForgeComboBound) return;
    weaponForgeComboBound = true;
    var combo = $("paWeaponForgeCombo");
    var input = $("paWeaponForgeInput");
    var list = $("paWeaponForgeList");
    if (!combo || !input || !list) return;

    input.addEventListener("click", function () {
      if (list.hidden) openWeaponForgeList();
      else closeWeaponForgeList();
    });
    input.addEventListener("focus", function () {
      openWeaponForgeList();
    });
    list.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    document.addEventListener("click", function (e) {
      if (!combo.contains(e.target)) closeWeaponForgeList();
    });
  }

  function onWeaponForgeToggle() {
    updateWeaponForgeSummary();
    syncWeaponStatsWithForge(activeWeaponForForge);
    renderResult(readForm());
  }

  function renderWeaponForgePanel(wep) {
    activeWeaponForForge = wep;
    var field = $("paWeaponForgeField");
    var list = $("paWeaponForgeList");
    var input = $("paWeaponForgeInput");
    if (!field || !list) return;
    closeWeaponForgeList();
    if (!wep || !wep.forgeOptions || !wep.forgeOptions.length) {
      field.hidden = true;
      list.innerHTML = "";
      if (input) {
        input.value = "";
        input.placeholder = "请先选择武器";
      }
      return;
    }
    field.hidden = false;
    if (input) input.placeholder = "点击选择可锻造属性…";
    list.innerHTML = wep.forgeOptions
      .map(function (opt) {
        return (
          '<li class="panel-calc-combo-option panel-calc-forge-option" role="option" data-code="' +
          opt.code +
          '" data-value="' +
          opt.value +
          '">' +
          '<span class="panel-calc-combo-option-name">' +
          escapeHtml(opt.text) +
          "</span></li>"
        );
      })
      .join("");
    list.querySelectorAll(".panel-calc-forge-option").forEach(function (li) {
      li.addEventListener("click", function () {
        var wasSelected = li.classList.contains("is-selected");
        list.querySelectorAll(".panel-calc-forge-option").forEach(function (row) {
          row.classList.remove("is-selected");
        });
        if (!wasSelected) li.classList.add("is-selected");
        onWeaponForgeToggle();
        closeWeaponForgeList();
      });
    });
    updateWeaponForgeSummary();
  }

  function gearAttackFlat(item) {
    if (!item || item.attackFlat == null) return 0;
    return item.attackFlat;
  }

  function gearAttackPct(item) {
    if (!item || item.attackPct == null) return 0;
    return item.attackPct;
  }

  function gearMeta(item) {
    var parts = [];
    var f = gearAttackFlat(item);
    var p = gearAttackPct(item);
    if (f) parts.push("固定 " + f);
    if (p) parts.push("攻% " + p);
    return parts.length ? parts.join(" · ") : "无攻击词条";
  }

  function applyEquipPick(item, flatId, pctId) {
    if (!item) return;
    var flatEl = $(flatId);
    var pctEl = $(pctId);
    if (flatEl) flatEl.value = gearAttackFlat(item);
    if (pctEl) pctEl.value = gearAttackPct(item);
  }

  function setupGearCombo(opts) {
    var list = DATA[opts.dataKey] || [];
    return setupCombo({
      wrapperId: opts.wrapperId,
      inputId: opts.inputId,
      listId: opts.listId,
      hiddenId: opts.hiddenId,
      items: list,
      meta: gearMeta,
      onPick: function (item) {
        applyEquipPick(item, opts.flatId, opts.pctId);
      },
    });
  }

  /**
   * 输入联想：hidden 存列表下标，未选中时仍可按名称精确匹配或完全手填数值。
   */
  function setupCombo(opts) {
    var wrapper = $(opts.wrapperId);
    var input = $(opts.inputId);
    var listEl = $(opts.listId);
    var hidden = $(opts.hiddenId);
    var items = opts.items || [];
    var maxShow = opts.maxShow || 14;
    var activeIdx = -1;

    if (!wrapper || !input || !listEl || !hidden) return null;

    ["pointerdown", "mousedown", "click"].forEach(function (ev) {
      wrapper.addEventListener(ev, function (e) {
        e.stopPropagation();
      });
    });

    function filter(q) {
      q = String(q || "").trim();
      var matches = [];
      if (!q) {
        for (var i = 0; i < items.length && matches.length < maxShow; i++) {
          matches.push({ idx: i, it: items[i] });
        }
        return matches;
      }
      var ql = q.toLowerCase();
      for (var j = 0; j < items.length && matches.length < maxShow; j++) {
        var name = items[j].name;
        if (name.indexOf(q) >= 0 || name.toLowerCase().indexOf(ql) >= 0) {
          matches.push({ idx: j, it: items[j] });
        }
      }
      return matches;
    }

    function closeList() {
      listEl.hidden = true;
      input.setAttribute("aria-expanded", "false");
      activeIdx = -1;
      listEl.querySelectorAll(".panel-calc-combo-option").forEach(function (el) {
        el.classList.remove("is-active");
      });
    }

    function openList() {
      listEl.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function renderList(matches) {
      if (!matches.length) {
        listEl.innerHTML =
          '<li class="panel-calc-combo-empty" role="presentation">无匹配，可继续手填下方数值</li>';
        openList();
        return;
      }
      listEl.innerHTML = matches
        .map(function (m) {
          var meta = opts.meta ? opts.meta(m.it) : "";
          return (
            '<li class="panel-calc-combo-option" role="option" data-idx="' +
            m.idx +
            '">' +
            '<span class="panel-calc-combo-option-name">' +
            escapeHtml(m.it.name) +
            "</span>" +
            (meta
              ? '<span class="panel-calc-combo-option-meta">' + escapeHtml(meta) + "</span>"
              : "") +
            "</li>"
          );
        })
        .join("");
      openList();
    }

    function highlightOption(li) {
      listEl.querySelectorAll(".panel-calc-combo-option").forEach(function (el) {
        el.classList.remove("is-active");
      });
      if (li) li.classList.add("is-active");
    }

    function selectIndex(idx, silent) {
      var it = items[idx];
      if (!it) return;
      hidden.value = String(idx);
      input.value = it.name;
      closeList();
      if (opts.onPick) opts.onPick(it);
      if (!silent) renderResult(readForm());
    }

    function clearPick() {
      hidden.value = "";
      if (opts.onPick) opts.onPick(null);
    }

    input.addEventListener("input", function () {
      clearPick();
      renderList(filter(input.value));
      renderResult(readForm());
    });

    input.addEventListener("focus", function () {
      renderList(filter(input.value));
    });

    listEl.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });

    listEl.addEventListener("click", function (e) {
      var li = e.target.closest(".panel-calc-combo-option");
      if (!li) return;
      selectIndex(parseInt(li.getAttribute("data-idx"), 10));
    });

    input.addEventListener("keydown", function (e) {
      var options = listEl.querySelectorAll(".panel-calc-combo-option[data-idx]");
      if (e.key === "Escape") {
        closeList();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (listEl.hidden) renderList(filter(input.value));
        if (!options.length) return;
        activeIdx = Math.min(activeIdx + 1, options.length - 1);
        highlightOption(options[activeIdx]);
        options[activeIdx].scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!options.length) return;
        activeIdx = Math.max(activeIdx - 1, 0);
        highlightOption(options[activeIdx]);
        options[activeIdx].scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Enter") {
        if (listEl.hidden || activeIdx < 0 || !options[activeIdx]) return;
        e.preventDefault();
        selectIndex(parseInt(options[activeIdx].getAttribute("data-idx"), 10));
      }
    });

    input.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (wrapper.contains(document.activeElement)) return;
        closeList();
        var exact = findByName(items, input.value);
        if (exact) {
          var idx = items.indexOf(exact);
          if (idx >= 0) selectIndex(idx, true);
        }
      }, 120);
    });

    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) closeList();
    });

    return {
      setByIndex: function (i) {
        if (i >= 0 && i < items.length) selectIndex(i, true);
      },
      setByName: function (name) {
        var idx = -1;
        for (var k = 0; k < items.length; k++) {
          if (items[k].name === name) {
            idx = k;
            break;
          }
        }
        if (idx >= 0) selectIndex(idx, true);
        else {
          hidden.value = "";
          input.value = name || "";
        }
      },
    };
  }

  /** 表「面板攻击计算」E8（列名九阴奇功）：技艺 A8 与 M6 爆伤判定名，可与武功 E2 不同 */
  function e8NameForFormula() {
    var el = $("paJiuyin");
    return el && el.value.trim() ? el.value.trim() : "";
  }

  /** 与 Excel M6：=IF(E8="飞絮暗劲",0.1,0) */
  function jiuyinCritFromE8(e8Name) {
    return e8Name === "飞絮暗劲" ? 0.1 : 0;
  }

  /** 与 Excel A8 技艺加成比例（乘在 B 段上得 F11） */
  function artsRatio(opts) {
    var name = opts.charName || "";
    var zhuque = opts.zhuque || 0;
    var jianyi = opts.jianyi || 0;
    var quanjin = opts.quanjin || 0;
    var e8Name = opts.e8Name || "";
    var tiezhi = opts.tiezhi || 0;
    var wuqin = opts.wuqin || 0;
    var haoRan = opts.haoRan != null ? opts.haoRan : opts.haoran || 0;
    var longxiang = opts.longxiang || 0;
    var qitian = opts.qitian || 0;
    var isMaleFist = opts.isMaleFist === "是";
    var isFistMain = opts.isFistMain === "是";
    var isHuFemale = opts.isHuFemale === "是";

    if (name === "孙齐") return floor(qitian / 60) * 0.04;
    if (name === "甘凌") return 0.08;
    // 与 xlsx A8：AND(A2="宗泽",H8=300)
    if (name === "宗泽" && haoRan >= 300) return 0.1;
    if (isHuFemale === true || isHuFemale === "是") return floor(longxiang / 30) / 100;

    if (name === "男主" || name === "女主") {
      var r =
        floor(zhuque / 30) / 100 +
        floor(jianyi / 30) / 50 +
        floor(quanjin / 30) / 50;
      if (isMaleFist) r += floor(tiezhi / 100) / 100;
      if (isFistMain) r += floor(wuqin / 30) / 100;
      if (e8Name === "摧心掌力") r += 0.2;
      else if (e8Name === "乱披风剑诀" || e8Name === "修罗刀诀") r += 0.1;
      return r;
    }
    return 0;
  }

  function compute(opts) {
    var atkGrowth = opts.atkGrowth;
    var skillPower = opts.skillPower;
    var internalPct = opts.internalPct;
    var pills = opts.pills;
    var skillSmallRen = opts.skillSmallRen;
    var atkInternalRen = opts.atkInternalRen;
    var skillBigRen = opts.skillBigRen;

    var weaponAtk = opts.weaponAtk;
    var weaponPct = opts.weaponPct;
    var clothFlat = opts.clothFlat;
    var clothPct = opts.clothPct;
    var ringFlat = opts.ringFlat;
    var ringPct = opts.ringPct;
    var bracerFlat = opts.bracerFlat;
    var bracerPct = opts.bracerPct;

    var otherSkillBonus = opts.otherSkillBonus || 0;

    var baseAttack = round(BASE * atkGrowth);
    var bCore = floor(skillPower + baseAttack * (100 + pills) / 100);
    var renInternal = floor(baseAttack * atkInternalRen * 0.1);
    var skillSmall = floor((skillPower * skillSmallRen) / 100);
    var internalBonus = round(bCore * internalPct);
    var otherSkillFlat = (skillPower * otherSkillBonus) / 100;

    var eWeapon = floor(weaponAtk + bCore * weaponPct / 100);
    var eCloth = floor(clothFlat + bCore * clothPct / 100);
    var eRing = floor(ringFlat + bCore * ringPct / 100);
    var eBracer = floor(bracerFlat + bCore * bracerPct / 100);
    var e11 = eWeapon + eCloth + eRing + eBracer;

    var aRatio = opts.artsRatio != null ? opts.artsRatio : 0;
    var f11 = round(bCore * aRatio);

    // 与 xlsx「面板攻击计算」A13 一致：B13 + 任督内功 + floor(威力×小任督%) + (内功%段 + 其他武功%) + 装备 + 技艺
    var panelCore = floor(
      bCore +
        renInternal +
        skillSmall +
        internalBonus +
        otherSkillFlat +
        e11 +
        f11
    );
    var panelBigRen = floor(panelCore + floor(panelCore * skillBigRen * 0.05));

    var critMult = opts.critMult || 1;
    var skillCoeff = opts.skillCoeff || 1;
    var extraDmg = opts.extraDmg || 0;
    var singleDmg = round(panelBigRen * critMult * skillCoeff + extraDmg);
    var singleMax = round(singleDmg * 1.1);

    return {
      baseAttack: baseAttack,
      bCore: bCore,
      renInternal: renInternal,
      skillSmall: skillSmall,
      internalBonus: internalBonus,
      otherSkillFlat: otherSkillFlat,
      equipSum: e11,
      artsFlat: f11,
      panelCore: panelCore,
      panelBigRen: panelBigRen,
      singleDmg: singleDmg,
      singleMax: singleMax,
      artsRatio: aRatio,
    };
  }

  /** 表 A2：技艺公式用角色名（与成长角色可分开填在「角色名（技艺公式）」） */
  function artsCharNameForFormula(ch) {
    var fromField = $("paCharName") && $("paCharName").value.trim();
    if (fromField) return fromField;
    return ch ? ch.name : "";
  }

  function isProtagonistArtsName(name) {
    return name === "男主" || name === "女主";
  }

  /** 表 B6 中 H6、I6：H6=INT(白虎/30)/100+IF(男主/女主,I6,0)；I6=INT(朱雀/30)/100+书法+M6 */
  function sheetArtsCritMult(artsCharName, baihu, zhuque, calligraphy, jiuyinCrit) {
    var i6 = floor(zhuque / 30) / 100 + calligraphy + jiuyinCrit;
    var h6 = floor(baihu / 30) / 100;
    if (isProtagonistArtsName(artsCharName)) h6 += i6;
    return h6;
  }

  function readForm() {
    var ch = selectedItem($("paChar"), DATA.characters);
    var ma = resolveComboItem("paMartial", "paMartialInput", DATA.martial);
    var inn = resolveComboItem("paInternal", "paInternalInput", DATA.internal);
    var artsCharName = artsCharNameForFormula(ch);
    var atkGrowth = ch ? ch.atkGrowth : num("paAtkGrowth", 1.2);
    var skillPower = ma ? ma.power : num("paSkillPower", 0);
    var skillCoeff = ma && ma.coeff != null ? ma.coeff : num("paSkillCoeff", 1);
    var skillCrit = ma && ma.critDmg != null ? ma.critDmg : num("paSkillCrit", 1.5);
    var internalPct = inn && inn.attackPct != null ? inn.attackPct : num("paInternalPct", 0);
    var internalCrit = inn && inn.critDmgPct != null ? inn.critDmgPct : 0;
    var weaponAtk = num("paWeaponAtk", 0);
    var weaponPctVal = num("paWeaponPct", 0);

    var martialName = ma ? ma.name : ($("paMartialInput") && $("paMartialInput").value.trim()) || $("paMartialName").value.trim();
    var e8Name = e8NameForFormula();

    var ar = artsRatio({
      charName: artsCharName,
      zhuque: num("paZhuque"),
      jianyi: num("paJianyi"),
      quanjin: num("paQuanjin"),
      e8Name: e8Name,
      martialName: martialName,
      tiezhi: num("paTiezhi"),
      wuqin: num("paWuqin"),
      haoRan: num("paHaoran"),
      longxiang: num("paLongxiang"),
      qitian: num("paQitian"),
      isMaleFist: $("paMaleFist").value,
      isFistMain: $("paFistMain").value,
      isHuFemale: $("paHuFemale").value,
    });

    if ($("paArtsManual").checked) {
      ar = num("paArtsRatioManual", 0);
    }

    var equipCrit = num("paEquipCrit");
    var weaponCrit = num("paWeaponCrit");
    var baihu = num("paBaihu");
    var zhuqueLvl = num("paZhuque");
    var calligraphy = num("paCalligraphy");
    var jiuyinCrit = jiuyinCritFromE8(e8Name);
    var jiuyinCritEl = $("paJiuyinCritSkill");
    if (jiuyinCritEl) jiuyinCritEl.value = String(jiuyinCrit);
    var h6 = sheetArtsCritMult(artsCharName, baihu, zhuqueLvl, calligraphy, jiuyinCrit);
    var critMult = equipCrit + weaponCrit + h6 + skillCrit + internalCrit;

    var result = compute({
      atkGrowth: atkGrowth,
      skillPower: skillPower,
      internalPct: internalPct,
      pills: num("paPills"),
      skillSmallRen: num("paSkillSmallRen"),
      atkInternalRen: num("paAtkInternalRen"),
      skillBigRen: num("paSkillBigRen"),
      weaponAtk: weaponAtk,
      weaponPct: weaponPctVal,
      clothFlat: num("paClothFlat"),
      clothPct: num("paClothPct"),
      ringFlat: num("paRingFlat"),
      ringPct: num("paRingPct"),
      bracerFlat: num("paBracerFlat"),
      bracerPct: num("paBracerPct"),
      otherSkillBonus: num("paOtherSkillBonus"),
      artsRatio: ar,
      critMult: critMult,
      skillCoeff: skillCoeff,
      extraDmg: num("paExtraDmg"),
    });
    result.artsFormulaChar = artsCharName;
    return result;
  }

  function fmtNum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function renderResult(r) {
    var el = $("paResult");
    if (!el) return;
    var pctArts = (r.artsRatio * 100).toFixed(2);
    el.innerHTML =
      '<div class="panel-calc-stat-hero">' +
      '<div class="panel-calc-stat-card panel-calc-stat-card--primary">' +
      '<span class="panel-calc-stat-label">面板攻击</span>' +
      '<span class="panel-calc-stat-value">' +
      fmtNum(r.panelCore) +
      "</span>" +
      "</div>" +
      '<div class="panel-calc-stat-card panel-calc-stat-card--accent">' +
      '<span class="panel-calc-stat-label">大任督后</span>' +
      '<span class="panel-calc-stat-value">' +
      fmtNum(r.panelBigRen) +
      "</span>" +
      '<span class="panel-calc-stat-hint">每级大任督 +5%</span>' +
      "</div>" +
      '<div class="panel-calc-stat-card panel-calc-stat-card--dmg">' +
      '<span class="panel-calc-stat-label">对单总伤</span>' +
      '<span class="panel-calc-stat-value">' +
      fmtNum(r.singleDmg) +
      "</span>" +
      '<span class="panel-calc-stat-hint">上限约 ' +
      fmtNum(r.singleMax) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="panel-calc-result-breakdown">' +
      '<h3 class="panel-calc-result-details-title">分项明细</h3>' +
      '<dl class="panel-calc-result">' +
      '<div class="panel-calc-result-row"><dt>基础攻击</dt><dd>' +
      fmtNum(r.baseAttack) +
      "</dd></div>" +
      '<div class="panel-calc-result-row"><dt>核心段 B</dt><dd>' +
      fmtNum(r.bCore) +
      '<span class="panel-calc-result-note">威力 + 基础×(100+丹)</span></dd></div>' +
      '<div class="panel-calc-result-row"><dt>内功任督</dt><dd>' +
      fmtNum(r.renInternal) +
      "</dd></div>" +
      '<div class="panel-calc-result-row"><dt>武功小任督</dt><dd>' +
      fmtNum(r.skillSmall) +
      "</dd></div>" +
      '<div class="panel-calc-result-row"><dt>内功% + 其他武功%</dt><dd>' +
      fmtNum(Math.round(r.internalBonus + r.otherSkillFlat)) +
      "</dd></div>" +
      '<div class="panel-calc-result-row"><dt>装备攻击</dt><dd>' +
      fmtNum(r.equipSum) +
      '<span class="panel-calc-result-note">技艺段 F11 +' +
      fmtNum(r.artsFlat) +
      "</span></dd></div>" +
      '<div class="panel-calc-result-row"><dt>技艺公式 A2</dt><dd>' +
      escapeHtml(r.artsFormulaChar || "（未填，面板技艺为 0）") +
      '<span class="panel-calc-result-note">比例 ' +
      pctArts +
      "%</span></dd></div>" +
      "</dl></div>";
  }

  function onSelectChange() {
    var ch = selectedItem($("paChar"), DATA.characters);
    if (ch) {
      $("paCharName").value = ch.name;
      $("paAtkGrowth").value = ch.atkGrowth;
    } else {
      $("paCharName").value = "";
      $("paAtkGrowth").value = "";
    }
    renderResult(readForm());
  }

  function applyMartialPick(ma) {
    if (ma) {
      $("paMartialName").value = ma.name;
      $("paSkillPower").value = ma.power;
      if (ma.coeff != null) $("paSkillCoeff").value = ma.coeff;
      if (ma.critDmg != null) $("paSkillCrit").value = ma.critDmg;
    }
  }

  function applyWeaponPick(wep) {
    if (!wep) {
      renderWeaponForgePanel(null);
      return;
    }
    renderWeaponForgePanel(wep);
    syncWeaponStatsWithForge(wep);
  }

  function applyInternalPick(inn) {
    if (inn && inn.attackPct != null) $("paInternalPct").value = inn.attackPct;
  }

  var martialCombo;
  var weaponCombo;
  var internalCombo;

  var fieldMaxSnapshots = {};

  function applyFieldMaxToggle(chk) {
    var id = chk.getAttribute("data-target");
    var maxVal = chk.getAttribute("data-max") || "300";
    var el = id && $(id);
    if (!el) return;
    if (chk.checked) {
      if (fieldMaxSnapshots[id] == null) fieldMaxSnapshots[id] = el.value;
      el.value = maxVal;
      el.readOnly = true;
      el.classList.add("panel-calc-input--bound");
    } else {
      el.readOnly = false;
      el.classList.remove("panel-calc-input--bound");
      if (fieldMaxSnapshots[id] != null) el.value = fieldMaxSnapshots[id];
      delete fieldMaxSnapshots[id];
    }
  }

  function initFieldMaxToggles() {
    document.querySelectorAll(".pa-field-max").forEach(function (chk) {
      chk.addEventListener("change", function () {
        applyFieldMaxToggle(chk);
        renderResult(readForm());
      });
    });
  }

  function syncArtsManualField() {
    var chk = $("paArtsManual");
    var numEl = $("paArtsRatioManual");
    if (!chk || !numEl) return;
    numEl.disabled = !chk.checked;
  }

  function init() {
    fillSelect($("paChar"), DATA.characters, "name", "atkGrowth");

    internalCombo = setupCombo({
      wrapperId: "paInternalCombo",
      inputId: "paInternalInput",
      listId: "paInternalList",
      hiddenId: "paInternal",
      items: DATA.internal,
      meta: function (inn) {
        var parts = [];
        if (inn.grade) parts.push(inn.grade);
        if (inn.attackPct != null) parts.push("攻% " + inn.attackPct);
        return parts.join(" · ");
      },
      onPick: applyInternalPick,
    });

    martialCombo = setupCombo({
      wrapperId: "paMartialCombo",
      inputId: "paMartialInput",
      listId: "paMartialList",
      hiddenId: "paMartial",
      items: DATA.martial,
      meta: function (m) {
        return "威力 " + m.power;
      },
      onPick: applyMartialPick,
    });

    weaponCombo = setupCombo({
      wrapperId: "paWeaponCombo",
      inputId: "paWeaponInput",
      listId: "paWeaponList",
      hiddenId: "paWeapon",
      items: DATA.weapons,
      meta: function (w) {
        var s = "攻击 " + w.attack;
        var p = weaponAttackPct(w);
        if (p) s += " · 攻% " + p;
        if (w.critDmg != null && w.critDmg > 0) {
          s += " · 暴伤 " + Math.round(w.critDmg * 100) + "%";
        }
        return s;
      },
      onPick: applyWeaponPick,
    });

    setupGearCombo({
      wrapperId: "paClothCombo",
      inputId: "paClothInput",
      listId: "paClothList",
      hiddenId: "paCloth",
      dataKey: "armors",
      flatId: "paClothFlat",
      pctId: "paClothPct",
    });
    setupGearCombo({
      wrapperId: "paRingCombo",
      inputId: "paRingInput",
      listId: "paRingList",
      hiddenId: "paRing",
      dataKey: "rings",
      flatId: "paRingFlat",
      pctId: "paRingPct",
    });
    setupGearCombo({
      wrapperId: "paBracerCombo",
      inputId: "paBracerInput",
      listId: "paBracerList",
      hiddenId: "paBracer",
      dataKey: "bracers",
      flatId: "paBracerFlat",
      pctId: "paBracerPct",
    });

    ["paChar"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", onSelectChange);
    });

    document.querySelectorAll(".panel-calc-form input, .panel-calc-form select").forEach(function (el) {
      el.addEventListener("input", function () {
        renderResult(readForm());
      });
      el.addEventListener("change", function () {
        renderResult(readForm());
      });
    });

    var artsManual = $("paArtsManual");
    if (artsManual) {
      artsManual.checked = false;
      artsManual.addEventListener("change", function () {
        syncArtsManualField();
        renderResult(readForm());
      });
      syncArtsManualField();
    }

    initFieldMaxToggles();
    bindWeaponForgeCombo();

    $("paChar").value = "";

    onSelectChange();
    syncFoldPanelsForViewport();
    window.addEventListener("resize", syncFoldPanelsForViewport);
  }

  function syncFoldPanelsForViewport() {
    var wide = window.matchMedia("(min-width: 961px)").matches;
    if (!wide) return;
    document.querySelectorAll(".panel-calc-fold").forEach(function (el) {
      el.open = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
