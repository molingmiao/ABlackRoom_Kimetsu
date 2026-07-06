// ESLint flat config（ESLint v9+）。
// 设计为对 legacy 代码尽量宽容：只把真正的"未定义全局/重复声明"标错，其它降为警告。
// 由于游戏脚本是浏览器全局风格（非 ES module），sourceType 用 'script'。

import js from '@eslint/js';
import globals from 'globals';

const gameGlobals = {
	// 游戏模块（全局赋值）
	Engine: 'writable',
	Room: 'writable',
	Outside: 'writable',
	Path: 'writable',
	World: 'writable',
	Ship: 'writable',
	Space: 'writable',
	Fabricator: 'writable',
	Events: 'writable',
	Notifications: 'writable',
	AudioEngine: 'writable',
	AudioLibrary: 'readonly',
	Button: 'writable',
	Header: 'writable',
	Score: 'writable',
	Prestige: 'writable',
	Enemies: 'writable',
	Achievements: 'writable',
	StateManager: 'writable',
	$SM: 'writable',
	State: 'writable',
	langs: 'readonly',
	Dropbox: 'readonly',
	Base64: 'readonly',
	gtag: 'readonly',
	// 旧 GA 全局，源码用 typeof ga === 'function' 守卫；登记以静音 no-undef
	ga: 'readonly',
	oldIE: 'writable',
	swipeElement: 'writable',
	// gettext 翻译辅助
	_: 'readonly'
};

export default [
	{
		ignores: [
			'lib/**',
			'lang/**',
			'node_modules/**',
			'tools/**',
			'audio/**',
			'img/**',
			'doc/**'
		]
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'script',
			globals: {
				...globals.browser,
				...globals.jquery,
				...gameGlobals
			}
		},
		rules: {
			// 真错误
			'no-undef': 'error',

			// legacy 风格——降为警告或关闭
			'no-unused-vars': ['warn', {
				args: 'none',
				// catch(e) / catch(_ignored) / catch(_) 等不报
				caughtErrors: 'all',
				caughtErrorsIgnorePattern: '^(_|e$|err$|ignored$)'
			}],
			// 源码大量使用 `var Engine = window.Engine = {...}` 这种"既声明又赋全局"模式，
			// 与 globals 配置里的同名全局会触发 no-redeclare；关闭这一项
			'no-redeclare': 'off',
			'no-constant-condition': 'warn',
			// 空 catch 块（catch(_) {}）是 legacy 的"静默忽略"约定，允许
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-self-assign': 'warn',
			'no-prototype-builtins': 'off',
			'no-cond-assign': 'off',
			'no-fallthrough': 'warn',
			'no-useless-escape': 'warn',
			'no-inner-declarations': 'off',
			'no-sparse-arrays': 'warn'
		}
	},
	{
		// dev-server.js 是 Node ESM
		files: ['dev-server.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: { ...globals.node }
		}
	}
];
