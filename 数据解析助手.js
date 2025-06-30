// ==UserScript==
// @name         Enhanced Player Info Extractor
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  new
// @author       You
// @match        *://*/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const unsafeWindow = window.unsafeWindow || window;
    let playerEntries = [];
    let settings = {
        onlyBoss: false,
        onlyGeneral: false
    };

    // 天赋技能映射表
    const talentMap = {
        '100400': '复生诅咒',
        '101300': '迅捷专精',

        '100100': '坐骑猎手',
        '100300': '法宝抑制',
        '100900': '视野共享',

        '100500': '撕裂伤口',
        '101700': '抗性强化',
        '101200': '绝地反击',

        '101400': '坐骑抑制',
        '101500': '坚固矿脉'
    };

    // 从本地存储加载设置
    function loadSettings() {
        const savedSettings = localStorage.getItem('playerInfoSettings');
        if (savedSettings) {
            try {
                settings = JSON.parse(savedSettings);
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }

    // 保存设置到本地存储
    function saveSettings() {
        localStorage.setItem('playerInfoSettings', JSON.stringify(settings));
    }

    const nativeLog = unsafeWindow.console.log.bind(unsafeWindow.console);

    // 重置功能
    function resetData() {
        playerEntries = [];
        updatePanel();
    }

    // 历史记录监听
    function setupHistoryListeners() {
        const { pushState, replaceState } = history;

        history.pushState = function(...args) {
            const result = pushState.apply(this, args);
            resetData();
            return result;
        };

        history.replaceState = function(...args) {
            const result = replaceState.apply(this, args);
            resetData();
            return result;
        };

        addEventListener('hashchange', resetData);
    }

    // 解析魔王天赋技能
    function parseBossTalents(talentSkill) {
        const talents = [];
        for (var key of talentSkill) {
            if (key){
                key = key.toString();
                const skillType = key.substring(0, 6);
                const skillLevel = key.substring(6);
                const skillName = talentMap[skillType] || `未知天赋(${skillType})`;
                talents.push(`${skillName}:${skillLevel}`);
            }
        }
        return talents;
    }

    // 玩家对象解析
    function parsePlayerObject(playerObj) {
        const isBoss = playerObj.mRecord?.bossInfo?.id != null;
        const entry = {
            burnPos: playerObj.mBurnPos?.name || null,
            name: playerObj.mConfig?.remark || null,
            magic: playerObj.mMagic?.mConfig?.name || null,
            ride: playerObj.mRecord?.ride?.name || null,
            wings: playerObj.mBeSkill?.mBeSkillParam?.threeJumpSkill?.[0]?.beSkillTplt?.name || null,

            uuid: playerObj.mRecord?.uid || null,
            playerName: playerObj.mRecord?.name || null,
            leagueName: playerObj.mRecord?.leagueName || null,
            isBoss: isBoss,
            isGeneral: !isBoss,
            talents: []
        };

        // 如果是魔王，解析天赋技能
        if (isBoss && playerObj.mRecord?.bossInfo?.talentSkill) {
            entry.talents = parseBossTalents(playerObj.mRecord.bossInfo.talentSkill);
        }

        if (entry.name || entry.burnPos || entry.magic || entry.wings || entry.talents.length) {
            playerEntries.unshift(entry);
        }
    }

    // 控制台监控
    unsafeWindow.console.log = function(...args) {
        if (args.some(a => typeof a === 'string' && a.includes("=====this.mPlayer"))) {
            const playerArray = args[2];
            if (playerArray) {
                playerEntries = [];
                for(let playerObj in playerArray){
                    parsePlayerObject(playerArray[playerObj])
                }
            }
        updatePanel();
        }
        nativeLog(...args);
    };

    // 面板创建
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'player-info-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 2147483647;
            width: 300px;
            max-height: 400px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.id = "button-Container";
        buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;';

        const buttons = [
            { text: '隐藏', bg: '#f39c12', action: togglePanelVisibility },
            { text: '重置', bg: '#e74c3c', action: resetData },
            { text: '设置', bg: '#3498db', action: toggleSettings },
            { text: '删除', bg: '#2c3e50', action: () => {
                panel.remove();
                document.getElementById('restore-panel-btn')?.remove();
            }}
        ];

        buttons.forEach(btnData => {
            const btn = document.createElement('button');
            btn.textContent = btnData.text;
            btn.style.cssText = `
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                flex: 1;
                min-width: 60px;
                background: ${btnData.bg};
            `;
            btn.onclick = btnData.action;
            buttonContainer.appendChild(btn);
        });

        panel.appendChild(buttonContainer);

        // 设置界面
        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'settings-container';
        settingsContainer.style.cssText = `
            background: rgba(40,40,50,0.8);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            display: none;
            flex-direction: column;
            gap: 12px;
        `;

        const settingTitle = document.createElement('div');
        settingTitle.textContent = '显示设置';
        settingTitle.style.cssText = 'font-weight: bold; color: #3498db; text-align: center; margin-bottom: 10px;';
        settingsContainer.appendChild(settingTitle);

        // 创建复选框
        const createCheckbox = (id, label, checked) => {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; align-items: center; gap: 8px;';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.checked = checked;
            checkbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer;';

            const labelEl = document.createElement('label');
            labelEl.htmlFor = id;
            labelEl.textContent = label;
            labelEl.style.cssText = 'cursor: pointer; user-select: none;';

            container.appendChild(checkbox);
            container.appendChild(labelEl);
            return container;
        };

        settingsContainer.appendChild(createCheckbox('only-boss', '仅显示魔王信息', settings.onlyBoss));
        settingsContainer.appendChild(createCheckbox('only-general', '仅显示神将信息', settings.onlyGeneral));

        panel.appendChild(settingsContainer);

        const entriesContainer = document.createElement('div');
        entriesContainer.id = 'player-entries-container';
        entriesContainer.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            padding: 5px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        panel.appendChild(entriesContainer);
        document.body.appendChild(panel);

        createRestoreButton();
        addScrollbarStyle();
    }

    // 切换设置界面
    function toggleSettings() {
        const settingsContainer = document.getElementById('settings-container');
        const settingBtn = document.querySelector('#button-Container button:nth-child(3)');

        if (settingsContainer.style.display === 'none') {
            // 显示设置界面
            settingsContainer.style.display = 'flex';
            settingBtn.textContent = '保存';
            settingBtn.style.background = '#27ae60';
        } else {
            // 保存设置
            settings.onlyBoss = document.getElementById('only-boss').checked;
            settings.onlyGeneral = document.getElementById('only-general').checked;
            saveSettings();

            // 隐藏设置界面
            settingsContainer.style.display = 'none';
            settingBtn.textContent = '设置';
            settingBtn.style.background = '#3498db';

            // 更新面板
            updatePanel();
        }
    }

    // 还原按钮
    function createRestoreButton() {
        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'restore-panel-btn';
        restoreBtn.textContent = '还原';
        restoreBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            z-index: 2147483646;
            display: none;
        `;
        restoreBtn.onclick = () => {
            document.getElementById('player-info-panel').style.display = 'flex';
            restoreBtn.style.display = 'none';
        };
        document.body.appendChild(restoreBtn);
    }

    // 滚动条样式
    function addScrollbarStyle() {
        const style = document.createElement('style');
        style.textContent = `
            #player-entries-container::-webkit-scrollbar {
                width: 8px;
            }
            #player-entries-container::-webkit-scrollbar-track {
                background: rgba(50,50,50,0.3);
            }
            #player-entries-container::-webkit-scrollbar-thumb {
                background: #3498db;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }

    // 面板可见性切换
    function togglePanelVisibility() {
        const panel = document.getElementById('player-info-panel');
        const restoreBtn = document.getElementById('restore-panel-btn');

        if (panel.style.display !== 'none') {
            panel.style.display = 'none';
            restoreBtn.style.display = 'block';
        } else {
            panel.style.display = 'flex';
            restoreBtn.style.display = 'none';
        }
    }

    // 创建属性显示元素
    function createPropertyElement(label, value) {
        if (!value) return null;

        const container = document.createElement('div');
        container.style.cssText = 'display: flex; gap: 8px;';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = `${label}:`;
        labelSpan.style.cssText = 'color: #3498db; font-weight: bold; min-width: 120px;';

        const valueSpan = document.createElement('span');
        valueSpan.textContent = value;
        valueSpan.style.cssText = 'flex-grow: 1; word-break: break-all;';

        container.appendChild(labelSpan);
        container.appendChild(valueSpan);
        return container;
    }

    // 更新面板显示
    function updatePanel() {
        const container = document.getElementById('player-entries-container');
        if (!container) return;

        container.innerHTML = playerEntries.length ? '' :
            '<div style="color:#aaa; text-align:center; padding:10px;">未检测到玩家信息</div>';

        // 过滤玩家条目
        const filteredEntries = playerEntries.filter(entry => {
            if (settings.onlyBoss && settings.onlyGeneral) {
                return entry.isBoss || entry.isGeneral;
            }
            if (settings.onlyBoss) return entry.isBoss;
            if (settings.onlyGeneral) return entry.isGeneral;
            return true;
        });

        if (filteredEntries.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">没有符合条件的玩家</div>';
            return;
        }

        filteredEntries.forEach(entry => {
            const entryEl = document.createElement('div');
            entryEl.style.cssText = `
                background: rgba(30,30,40,0.7);
                border-radius: 8px;
                padding: 12px;
                position: relative;
            `;

            // 主视图
            const mainView = document.createElement('div');
            mainView.id = "main-View";

            // 基本属性
            [
                ['出生点', entry.burnPos],
                ['角色', entry.name],
                ['坐骑', entry.ride],
                ['法宝', entry.magic],
                ['翅膀', entry.wings]
            ].forEach(([label, value]) => {
                const el = createPropertyElement(label, value);
                if (el) mainView.appendChild(el);
            });

            // 添加魔王天赋信息
            if (entry.isBoss && entry.talents.length > 0) {
                const talentsContainer = document.createElement('div');
                talentsContainer.style.cssText = 'margin-top: 8px;';

                const talentLabel = document.createElement('div');
                talentLabel.textContent = '魔王天赋:';
                talentLabel.style.cssText = 'color: #3498db; font-weight: bold; margin-bottom: 5px;';
                talentsContainer.appendChild(talentLabel);

                const talentList = document.createElement('div');
                talentList.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

                entry.talents.forEach(talent => {
                    const talentItem = document.createElement('div');
                    talentItem.textContent = `• ${talent}`;
                    talentItem.style.cssText = 'font-size: 13px; padding-left: 10px;';
                    talentList.appendChild(talentItem);
                });

                talentsContainer.appendChild(talentList);
                mainView.appendChild(talentsContainer);
            }

            if (!mainView.children.length) {
                mainView.innerHTML = '<div style="color:#e74c3c; text-align:center;">未提取到有效属性</div>';
            }

            // 详情视图
            const detailView = document.createElement('div');
            detailView.id = "detail-View";
            detailView.style.display = 'none';
            [
                ['uuid', entry.uuid],
                ['玩家名', entry.playerName],
                ['联盟', entry.leagueName]
            ].forEach(([label, value]) => {
                const el = createPropertyElement(label, value);
                if (el) detailView.appendChild(el);
            });

            if (!detailView.children.length) {
                detailView.innerHTML = '<div style="color:#e74c3c; text-align:center;">未提取到有效属性</div>';
            }

            // 切换按钮
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = '详细信息';
            toggleBtn.style.cssText = `
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: #9b59b6;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;

            toggleBtn.onclick = () => {
                if (mainView.style.display !== 'none') {
                    mainView.style.display = 'none';
                    detailView.style.display = 'block';
                    toggleBtn.textContent = '返回';
                } else {
                    mainView.style.display = 'block';
                    detailView.style.display = 'none';
                    toggleBtn.textContent = '详细信息';
                }
            };

            entryEl.append(mainView, detailView, toggleBtn);
            container.appendChild(entryEl);
        });
    }

    // 初始化
    function init() {
        loadSettings(); // 加载设置
        if (!document.getElementById('player-info-panel')) {
            createPanel();
        }
        setupHistoryListeners();
    }

    // 启动逻辑
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();