
import * as assert from 'assert';
import { Labels } from '../labels/labels';
//import { Settings } from '../settings';

suite('Labels', () => {

	setup(() => {
		/*const cfg: any = {
			remoteType: 'zrcp'
		};
		Settings.Init(cfg, '');
		*/
		Labels.init(250);
	});


	suite('Files/lines vs list file', () => {

		suite('z80asm', () => {

			test('getFileAndLineForAddress', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/test1.list', srcDirs: [""]}]};
				Labels.readListFiles(config);

				// Checks
				var res=Labels.getFileAndLineForAddress(0x7700);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 0, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x7710);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 1, "Expected line wrong.");


				var res=Labels.getFileAndLineForAddress(0x7721);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x7721);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x7723);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");



				var res=Labels.getFileAndLineForAddress(0x8820);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x8831);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 3, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x8833);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 3, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x8834);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 4, "Expected line wrong.");

				var res=Labels.getFileAndLineForAddress(0x8837);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 6, "Expected line wrong.");



				var res=Labels.getFileAndLineForAddress(0x8841);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 9, "Expected line wrong.");


				var res=Labels.getFileAndLineForAddress(0x8843);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 5, "Expected line wrong.");

			});


			test('getAddrForFileAndLine', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/test1.list', srcDirs: [""]}]};
				Labels.readListFiles(config);

				// main.asm
				var addr=Labels.getAddrForFileAndLine('main.asm', 0);
				assert.equal(addr, 0x7700, "Expected address wrong.");

				addr=Labels.getAddrForFileAndLine('main.asm', 1);
				assert.equal(addr, 0x7710, "Expected address wrong.");

				addr=Labels.getAddrForFileAndLine('main.asm', 2);
				assert.equal(addr, 0x7721, "Expected address wrong.");


				addr=Labels.getAddrForFileAndLine('zxspectrum.asm', 2);
				assert.equal(addr, 0x8820, "Expected address wrong.");

				addr=Labels.getAddrForFileAndLine('zxspectrum.asm', 4);
				assert.equal(addr, 0x8834, "Expected address wrong.");

				addr=Labels.getAddrForFileAndLine('zxspectrum.asm', 6);
				assert.equal(addr, 0x8837, "Expected address wrong.");

				addr=Labels.getAddrForFileAndLine('zxspectrum.asm', 9);
				assert.equal(addr, 0x8841, "Expected address wrong.");


				addr=Labels.getAddrForFileAndLine('main.asm', 5);
				assert.equal(addr, 0x8843, "Expected address wrong.");
			});


			test('get label values from list file', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/test2.list', srcDirs: [""]}]};
				Labels.readListFiles(config);

				let value=Labels.getNumberForLabel('screen_top');
				assert.equal(value, 0x6000, "Expected address wrong.");

				value=Labels.getNumberForLabel('PAUSE_TIME');
				assert.equal(value, 5000, "Expected value wrong.");

				value=Labels.getNumberForLabel('pause_loop_l2');
				assert.equal(value, 0x6004, "Expected address wrong.");

				value=Labels.getNumberForLabel('pause_loop_l1');
				assert.equal(value, 0x6006, "Expected address wrong.");

				value=Labels.getNumberForLabel('BCKG_LINE_SIZE');
				assert.equal(value, 32, "Expected value wrong.");

				value=Labels.getNumberForLabel('BLACK');
				assert.equal(value, 0, "Expected value wrong.");

				value=Labels.getNumberForLabel('MAGENTA');
				assert.equal(value, 3<<3, "Expected address wrong.");

			});


			test('get labels for a value from list file', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/test2.list', srcDirs: [""]}]};
				Labels.readListFiles(config);

				let labels=Labels.getLabelsForNumber(0x6000);
				assert.equal(labels[0], 'screen_top', "Expected label wrong.");

				labels=Labels.getLabelsForNumber(0x6004);
				assert.equal(labels[0], 'pause_loop_l2', "Expected label wrong.");

				labels=Labels.getLabelsPlusIndexForNumber(0x6008);
				assert.equal(labels[0], 'pause_loop_l1+2', "Expected label+index wrong.");

			});


		});	// z80asm


		suite('sjasmplus', () => {

			test('sjasmplus labels with ":"', () => {
				const config={sjasmplusListFiles: [{path: './src/tests/data/labels/sjasm1.list', srcDirs: [""]}]};
				const labels=Labels;
				labels.readListFiles(config);

				let value=labels.getNumberForLabel('screen_top');
				assert.equal(0x80cb, value, "Expected address wrong.");

				value=labels.getNumberForLabel('PAUSE_TIME');
				assert.equal(5000, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause');
				assert.equal(0x80cc, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause_loop_l2');
				assert.equal(0x80cf, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause_loop_l1');
				assert.equal(0x80d1, value, "Expected address wrong.");

				value=labels.getNumberForLabel('BCKG_LINE_SIZE');
				assert.equal(32, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CBLACK');
				assert.equal(0<<3, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CBLUE');
				assert.equal(1<<3, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CRED');
				assert.equal(2<<3, value, "Expected address wrong.");
			});


			test('sjasmplus labels without ":"', () => {
				const config={sjasmplusListFiles: [{path: './src/tests/data/labels/sjasm2_wo_colon.list', srcDirs: [""]}]};
				const labels=Labels;
				labels.readListFiles(config);

				let value=labels.getNumberForLabel('screen_top');
				assert.equal(0x80cb, value, "Expected address wrong.");

				value=labels.getNumberForLabel('PAUSE_TIME');
				assert.equal(5000, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause');
				assert.equal(0x80cc, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause_loop_l2');
				assert.equal(0x80cf, value, "Expected address wrong.");

				value=labels.getNumberForLabel('pause_loop_l1');
				assert.equal(0x80d1, value, "Expected address wrong.");

				value=labels.getNumberForLabel('BCKG_LINE_SIZE');
				assert.equal(32, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CBLACK');
				assert.equal(0<<3, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CBLUE');
				assert.equal(1<<3, value, "Expected address wrong.");

				value=labels.getNumberForLabel('CRED');
				assert.equal(2<<3, value, "Expected address wrong.");
			});
		});
	});	// sjasmplus


	suite('List files', () => {

		suite('z80asm', () => {

			test('z80asm.list', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/z80asm.list', srcDirs: [""]}]};
				Labels.readListFiles(config);

				// Checks
				let res=Labels.getNumberForLabel("check_score_for_new_ship");
				assert.equal(0x7015, res, "Label wrong.");

				res=Labels.getNumberForLabel("ltest1");
				assert.equal(0x701C, res, "Label wrong.");

				res=Labels.getNumberForLabel("SCREEN_COLOR");
				assert.equal(0x5800, res, "Label wrong.");

				res=Labels.getNumberForLabel("SCREEN_SIZE");
				assert.equal(0x1800, res, "Label wrong.");
			});

			test('rom.list', () => {
				const config={z80asmListFiles: [{path: './src/tests/data/labels/rom.list', srcDirs: []}]};
				Labels.readListFiles(config);

				// Checks
				let res=Labels.getNumberForLabel("L0055");
				assert.equal(0x0055, res, "Label wrong.");

				res=Labels.getNumberForLabel("L022C");
				assert.equal(0x022C, res, "Label wrong.");
			});
		});


		suite('z88dk', () => {

			test('z88dk.lis', () => {
				const config={z88dkListFiles: [{path: './src/tests/data/labels/z88dk.lis', srcDirs: [""], addOffset: 0, z88dkMapFile: undefined}]};
				Labels.readListFiles(config);

				// Checks
				let res=Labels.getNumberForLabel("ct_ui_first_table");
				assert.equal(0x000B, res, "Label wrong.");

				res=Labels.getNumberForLabel("display_hor_zero_markers");
				assert.equal(0x09A7, res, "Label wrong.");

				res=Labels.getNumberForLabel("display_hor_a_address");
				assert.equal(0x09A1, res, "Label wrong.");

				// defc (=equ) is not supported
				res=Labels.getNumberForLabel("MAGENTA");
				assert.notEqual(3, res, "Label wrong.");

				// defc (=equ) is not supported
				res=Labels.getNumberForLabel("CS_ROM_VALUE");
				assert.notEqual(0xF1, res, "Label wrong.");
			});


			test('address offset', () => {
				const config={z88dkListFiles: [{path: './src/tests/data/labels/z88dk.lis', srcDirs: [""], addOffset: 0x1000, z88dkMapFile: undefined}]};
				Labels.readListFiles(config);

				let res=Labels.getNumberForLabel("ct_ui_first_table");
				assert.equal(0x100B, res, "Label wrong.");

				let labels=Labels.getLabelsPlusIndexForNumber(0x100D);
				assert.equal(labels[0], 'ct_ui_first_table+2', "Expected label+index wrong.");
			});


			test('z88dk map file (currah)', () => {
				const config={z88dkListFiles: [{path: './src/tests/data/labels/currah_uspeech_tests.lis', srcDirs: [""], addOffset: 0, z88dkMapFile: './src/tests/data/labels/currah_uspeech_tests.map'}]};
				Labels.readListFiles(config);

				// Checks
				let res=Labels.getNumberForLabel("ct_input_l2");
				assert.equal(0x80A6, res, "Label wrong.");

				res=Labels.getNumberForLabel("main");
				assert.equal(0x8000, res, "Label wrong.");

				// defc (=equ) is not supported
				res=Labels.getNumberForLabel("print_number_address");
				assert.equal(undefined, res, "Label wrong.");

				res=Labels.getNumberForLabel("SCREEN_COLOR");
				assert.equal(undefined, res, "Label wrong.");
			});
		});
	});

});

