import * as assert from 'assert';
import {RemoteClass, RemoteBreakpoint, GenericBreakpoint, GenericWatchpoint} from '../remoteclass';
import {Z80Registers, Z80_REG} from '../z80registers';
import {MemBank16k} from './membank16k';
import {SnaFile} from './snafile';
import {NexFile} from './nexfile';
import {Settings} from '../../settings';
import * as path from 'path';


/**
 * A class that communicates with the remote via the DZRP protocol.
 * It is base class for all DZRP remote classes that implement
 * special transports like serial connection or socket.
 */
export class DzrpRemote extends RemoteClass {

	// The function to hold the Promise's resolve function for a continue request.
	protected continueResolve?: ({breakReason, tStates, cpuFreq}) => void;

	// Used to handle the notification during step-out.
	//protected stepOutHandler?: (breakReason: number) => void;


	/// Constructor.
	/// Override this.
	constructor() {
		super();
		// Instantiate the registers
		this.z80Registers=new Z80Registers();
	}


	/// Override.
	/// Initializes the machine.
	/// When ready it emits this.emit('initialized') or this.emit('error', Error(...));
	/// The successful emit takes place in 'onConnect' which should be called
	/// by 'doInitialization' after a successful connect.
	public async doInitialization() {
	}


	/**
	 * Call this from 'doInitialization' when a successful connection
	 * has been opened to the Remote.
	 * @emits this.emit('initialized') or this.emit('error', Error(...))
	 */
	protected async onConnect(): Promise<void> {
		try {
			// Get configuration
			const resp=await this.sendDzrpCmdGetconfig();
			// Check configuration
			this.supportsZxNextRegisters=(resp.zxNextRegs==true);
			// Load sna or nex file
			const loadPath=Settings.launch.load;
			if (loadPath)
				await this.loadBin(loadPath);
			// Ready
			this.emit('initialized')
		}
		catch (err) {
			this.emit('error', err);
		}
	}


	/**
	 * Override.
	 * Stops the emulator.
	 * This will disconnect the socket to zesarux and un-use all data.
	 * Called e.g. when vscode sends a disconnectRequest
	 * @param handler is called after the connection is disconnected.
	 */
	public async disconnect(): Promise<void> {
	}


	/**
	 * Override.
	 * Terminates the emulator.
	 * This will disconnect the socket to zesarux and un-use all data.
	 * Called e.g. when the unit tests want to terminate the emulator.
	 * This will also send a 'terminated' event. I.e. the vscode debugger
	 * will also be terminated.
	 */
	public async terminate(): Promise<void> {
	}


	/**
	* If cache is empty retrieves the registers from
	* the Remote.
	*/
	public async getRegisters(): Promise<void> {
		if (this.z80Registers.valid())
			return;

		// Get regs
		const regs=await this.sendDzrpCmdGetRegisters();
		// And set
		this.z80Registers.setCache(regs);
	}


	/**
	 * Sets the value for a specific register.
	 * Reads the value from the emulator and returns it in the promise.
	 * Note: if in reverse debug mode the function should do nothing and the promise should return the previous value.
	 * @param register The register to set, e.g. "BC" or "A'". Note: the register name has to exist. I.e. it should be tested before.
	 * @param value The new register value.
	 * @return Promise with the "real" register value.
	 */
	public async setRegisterValue(register: string, value: number): Promise<number> {
		const index=Z80Registers.getEnumFromName(register) as number;
		assert(index!=undefined);
		// Send command to set register
		await this.sendDzrpCmdSetRegister(index, value);
		// Send command to get registers
		this.z80Registers.clearCache();
		await this.getRegisters();
		// Return
		const realValue=this.z80Registers.getRegValueByName(register);
		return realValue;
	}


	/**
	 * 'continue' debugger program execution.
	 * @returns A Promise with {reason, tStates, cpuFreq}.
	 * Is called when it's stopped e.g. when a breakpoint is hit.
	 * breakReason contains the stop reason as string.
	 * tStates contains the number of tStates executed.
	 * cpuFreq contains the CPU frequency at the end.
	 */
	public async continue(): Promise<{breakReason: string, tStates?: number, cpuFreq?: number}> {
		return new Promise<{breakReason: string, tStates?: number, cpuFreq?: number}>(resolve => {
			// Save resolve function when break-response is received
			this.continueResolve=resolve;
			// Clear registers
			this.z80Registers.clearCache();
			// Send 'run' command
			this.sendDzrpCmdContinue();
		});
	}


	/**
	 * 'pause' the debugger.
	 */
	public async pause(): Promise<void> {
		// Send 'run' command
		await this.sendDzrpCmdPause();
	}


	/**
	 * 'step over' an instruction in the debugger.
	 * @param stepOver true=step-over, false=step-into.
	 * @returns A Promise with:
	 * 'instruction' is the disassembly of the current line.
	 * 'tStates' undefined.
	 * 'cpuFreq' undefined.
	 * 'breakReason' a possibly text with the break reason.
	 */
	public async stepOver(stepOver = true): Promise<{instruction: string, tStates?: number, cpuFreq?: number, breakReason?: string}> {
		return new Promise<{instruction: string, tStates?: number, cpuFreq?: number, breakReason?: string}>(async resolve => {
			await this.getRegisters();
			// Calculate the breakpoints to use for step-over
			let [opcode, bp1, bp2]=await this.calcStepBp(stepOver);

			// Disassemble
			const opCodeDescription=opcode.disassemble();
			const instruction=opCodeDescription.mnemonic;
			// Prepare for break: This function is called by the PAUSE (break) notification:
			this.continueResolve=({breakReason}) => {
				// Clear register cache
				this.z80Registers.clearCache();
				// return
				resolve({instruction, breakReason});
			};

			// Send command to 'continue'
			this.sendDzrpCmdContinue(bp1, bp2);
		});
	}


	/**
	 * 'step into' an instruction in the debugger.
	 * @returns A Promise:
	 * 'instruction' is the disassembly of the current line.
	 * 'tStates' contains the number of tStates executed.
	 * 'cpuFreq' contains the CPU frequency at the end.
	 * 'breakReason' a possibly text with the break reason. This is mainly to keep the
	 * record consistent with stepOver. But it is e.g. used to inform when the
	 * end of the cpu history is reached.
	 */
	public async stepInto(): Promise<{instruction: string, tStates?: number, cpuFreq?: number, breakReason?: string}> {
		return this.stepOver(false);
	}


	/**
	 * 'step out' of current subroutine.
	 * The step-out uses normal step (into) funcionality and check
	 * after each step if the last instruction was some RET and
	 * the stackpointer is bigger that at the beginning.
	 * @param A Promise that returns {tStates, cpuFreq, breakReason}
	 * 'tStates' contains the number of tStates executed.
	 * 'cpuFreq' contains the CPU frequency at the end.
	 * 'breakReason' a possibly text with the break reason.
	 */
	public async stepOut(): Promise<{tStates?: number, cpuFreq?: number, breakReason?: string}> {
		return new Promise<{tStates, cpuFreq, breakReason}>(async resolve => {
			// Get current SP
			const startSp=this.z80Registers.getRegValue(Z80_REG.SP);

			// Loop
			while (true) {
				// Get current SP
				const prevSp=this.z80Registers.getRegValue(Z80_REG.SP);
				// Do next step
				const stepResult=await this.stepInto();
				// Check if real breakpoint reached, i.e. breakReason.length!=0
				if (stepResult.breakReason) {
					// End reached
					const result={tStates: stepResult.tStates, cpuFreq: stepResult.cpuFreq, breakReason: stepResult.breakReason};
					resolve(result);
					break;
				}

				// Check if instruction was a RET(I/N)
				await this.getRegisters();
				const currSp=this.z80Registers.getRegValue(Z80_REG.SP);
				if (currSp>startSp && currSp>prevSp) {
					// Something has been popped. This is to exclude unexecuted RET cc.
					const instr=stepResult.instruction.toUpperCase();
					if (instr.startsWith("RET")) {
						// Stop here
						const result={tStates: stepResult.tStates, cpuFreq: stepResult.cpuFreq, breakReason: stepResult.breakReason};
						resolve(result);
						break;
					}
				}
			}
		});
	}


	/**
	 * Enables/disables all WPMEM watchpoints set from the sources.
	 * Promise is called when method finishes.
	 * @param enable true=enable, false=disable.
	 */
	public async enableWPMEM(enable: boolean): Promise<void> {
		assert(false);	// override this
	}


	/**
	 * Sets the watchpoints in the given list.
	 * Watchpoints result in a break in the program run if one of the addresses is written or read to.
	 * Promises is execute when last watchpoint has been set.
	 * @param watchPoints A list of addresses to put a guard on.
	 */
	public async setWatchpoints(watchPoints: Array<GenericWatchpoint>): Promise<void> {
		assert(false);	// override this
	}


	/**
	 * Set all assert breakpoints.
	 * Called only once.
	 * @param assertBreakpoints A list of addresses to put an assert breakpoint on.
	 */
	public setAssertBreakpoints(assertBreakpoints: Array<GenericBreakpoint>) {
		assert(false);	// override this
	}


	/**
	 * Enables/disables all assert breakpoints set from the sources.
	 * Promise is called when ready.
	 * @param enable true=enable, false=disable.
	 */
	public async enableAssertBreakpoints(enable: boolean): Promise<void> {
		assert(false);	// override this
	}


	/**
	 * Set all log points.
	 * Called only once.
	 * Promise is called after the last logpoint is set.
	 * @param logpoints A list of addresses to put a log breakpoint on.
	 */
	public async setLogpoints(logpoints: Array<GenericBreakpoint>): Promise<void> {
		assert(false);	// override this
	}


	/**
	 * Enables/disables all logpoints for a given group.
	 * Promise is called all logpoints are set.
	 * @param group The group to enable/disable. If undefined: all groups. E.g. "UNITTEST".
	 * @param enable true=enable, false=disable.
	 */
	public async enableLogpoints(group: string, enable: boolean): Promise<void> {
		assert(false);	// override this
	}


	/*
	 * Sets breakpoint in the Remote.
	 * Sets the breakpoint ID (bpId) in bp.
	 * @param bp The breakpoint.
	 * @returns The used breakpoint ID. 0 if no breakpoint is available anymore.
	 */
	public async setBreakpoint(bp: RemoteBreakpoint): Promise<number> {
		// Check for logpoint (not supported)
		if (bp.log) {
			this.emit('warning', 'DZRP does not support logpoints ("'+bp.log+'").');
			// set to unverified
			bp.address=-1;
			return 0;
		}
		// Check if "real" PC breakpoint
		if (bp.address<0) {
			this.emit('warning', 'DZRP does only support PC breakpoints.');
			// set to unverified
			bp.address=-1;
			return 0;
		}

		// Set breakpoint
		const bpId=await this.sendDzrpCmdAddBreakpoint(bp.address);

		// Add to list
		bp.bpId=bpId;
		this.breakpoints.push(bp);

		// return
		return bpId;
	}


	/**
	 * Clears one breakpoint.
	 */
	protected async removeBreakpoint(bp: RemoteBreakpoint): Promise<void> {
		await this.sendDzrpCmdRemoveBreakpoint(bp.bpId);

		// Remove from list
		let index=this.breakpoints.indexOf(bp);
		assert(index!==-1, 'Breakpoint should be removed but does not exist.');
		this.breakpoints.splice(index, 1);
	}


	/**
	 * Reads a memory.
	 * @param address The memory start address.
	 * @param size The memory size.
	 * @returns A promise with an Uint8Array.
	 */
	public async readMemoryDump(address: number, size: number): Promise<Uint8Array> {
		return await this.sendDzrpCmdReadMem(address, size);
	}


	/**
	 * Writes a memory dump.
	 * @param address The memory start address.
	 * @param dataArray The data to write.
	 */
	public async writeMemoryDump(address: number, dataArray: Uint8Array): Promise<void> {
		return await this.sendDzrpCmdWriteMem(address, dataArray);
	}


	/**
	 * Reads the memory pages, i.e. the slot/banks relationship from zesarux
	 * and converts it to an arry of MemoryPages.
	 * @returns A Promise with an array with the available memory pages.
	 */
	/*
	public async getMemoryPages(): Promise<MemoryPage[]> {
		return [];
	}
	*/


	/**
	 * Loads .nex or .sna files.
	 */
	protected async loadBin(filePath: string): Promise<void> {
		// Check file extension
		const ext=path.extname(filePath);
		if (ext=='.sna')
			await this.loadBinSna(filePath);
		else if (ext=='.nex')
			await this.loadBinNex(filePath);
		else {
			// Error: neither sna nor nex file
			throw Error("File extension unknown in '"+filePath+"'. Can only load .sna and .nex files.");
		}
		// Make sure that the registers are reloaded
		this.z80Registers.clearCache();
	}


	/**
	 * Loads a .sna file.
	 * See https://faqwiki.zxnet.co.uk/wiki/SNA_format
	 */
	protected async loadBinSna(filePath: string): Promise<void> {
		// Load and parse file
		const snaFile=new SnaFile();
		snaFile.readFile(filePath);

		// Transfer 16k memory banks
		for (const memBank of snaFile.memBanks) {
			// As 2x 8k memory banks
			const bank8=2*memBank.bank;
			await this.sendDzrpCmdWriteBank(bank8, memBank.data.slice(0, MemBank16k.BANK16K_SIZE/2));
			await this.sendDzrpCmdWriteBank(bank8+1, memBank.data.slice(MemBank16k.BANK16K_SIZE/2));
		}

		// Set the registers
		await this.sendDzrpCmdSetRegister(Z80_REG.PC, snaFile.pc);
		await this.sendDzrpCmdSetRegister(Z80_REG.SP, snaFile.sp);
		await this.sendDzrpCmdSetRegister(Z80_REG.AF, snaFile.af);
		await this.sendDzrpCmdSetRegister(Z80_REG.BC, snaFile.bc);
		await this.sendDzrpCmdSetRegister(Z80_REG.DE, snaFile.de);
		await this.sendDzrpCmdSetRegister(Z80_REG.HL, snaFile.hl);
		await this.sendDzrpCmdSetRegister(Z80_REG.IX, snaFile.ix);
		await this.sendDzrpCmdSetRegister(Z80_REG.IY, snaFile.iy);
		await this.sendDzrpCmdSetRegister(Z80_REG.AF2, snaFile.af2);
		await this.sendDzrpCmdSetRegister(Z80_REG.BC2, snaFile.bc2);
		await this.sendDzrpCmdSetRegister(Z80_REG.DE2, snaFile.de2);
		await this.sendDzrpCmdSetRegister(Z80_REG.HL2, snaFile.hl2);
		await this.sendDzrpCmdSetRegister(Z80_REG.R, snaFile.r);
		await this.sendDzrpCmdSetRegister(Z80_REG.I, snaFile.i);
	}


	/**
	 * Loads a .nex file.
	 * See https://wiki.specnext.dev/NEX_file_format
	 */
	protected async loadBinNex(filePath: string): Promise<void> {
		// Load and parse file
		const nexFile=new NexFile();
		nexFile.readFile(filePath);
		// Transfer 16k memory banks
		for (const memBank of nexFile.memBanks) {
			// As 2x 8k memory banks
			const bank8=2*memBank.bank;
			await this.sendDzrpCmdWriteBank(bank8, memBank.data.slice(0, MemBank16k.BANK16K_SIZE/2));
			await this.sendDzrpCmdWriteBank(bank8+1, memBank.data.slice(MemBank16k.BANK16K_SIZE/2));
		}
		// Set the SP and PC registers
		await this.sendDzrpCmdSetRegister(Z80_REG.SP, nexFile.sp);
		await this.sendDzrpCmdSetRegister(Z80_REG.PC, nexFile.pc);
	}



	//------- Send Commands -------

	/**
	 * Override.
	 * Sends the command to get the configuration.
	 * @returns The configuration, e.g. '{xNextRegs: true}'
	 */
	protected async sendDzrpCmdGetconfig(): Promise<{zxNextRegs: boolean}> {
		assert(false);
		return {zxNextRegs: false};
	}


	/**
	 * Override.
	 * Sends the command to get all registers.
	 * @returns An Uint16Array with the register data. Same order as in
	 * 'Z80Registers.getRegisterData'.
	 */
	protected async sendDzrpCmdGetRegisters(): Promise<Uint16Array> {
		assert(false);
		return new Uint16Array(0);
	}


	/**
	 * Override.
	 * Sends the command to set a register value.
	 * @param regIndex E.g. Z80_REG.BC or Z80_REG.A2
	 * @param value A 1 byte or 2 byte value.
	 */
	protected async sendDzrpCmdSetRegister(regIndex: Z80_REG, value: number): Promise<void> {
		assert(false);
	}


	/**
	 * Override.
	 * Sends the command to continue ('run') the program.
	 * @param bp1Address The address of breakpoint 1 or undefined if not used.
	 * @param bp2Address The address of breakpoint 2 or undefined if not used.
	 */
	protected async sendDzrpCmdContinue(bp1Address?: number, bp2Address?: number): Promise<void> {
		assert(false);
	}


	/**
	 * Override.
	 * Sends the command to pause a running program.
	 */
	protected async sendDzrpCmdPause(): Promise<void> {
		assert(false);
	}


	/**
	 * Override.
	 * Sends the command to add a breakpoint.
	 * @param bpAddress The breakpoint address. 0x0000-0xFFFF.
	 * @returns A Promise with the breakpoint ID (1-65535) or 0 in case
	 * no breakpoint is available anymore.
	 */
	protected async sendDzrpCmdAddBreakpoint(bpAddress: number): Promise<number> {
		assert(false);
		return 0;
	}


	/**
	 * Override.
	 * Sends the command to remove a breakpoint.
	 * @param bpId The breakpoint ID to remove.
	 */
	protected async sendDzrpCmdRemoveBreakpoint(bpId: number): Promise<void> {
		assert(false);
	}


	/**
	 * Override.
	 * Sends the command to retrieve a memory dump.
	 * @param address The memory start address.
	 * @param size The memory size.
	 * @returns A promise with an Uint8Array.
	 */
	protected async sendDzrpCmdReadMem(address: number, size: number): Promise<Uint8Array> {
		assert(false);
		return new Uint8Array(0);
	}


	/**
	 * Override.
	 * Sends the command to write a memory dump.
	 * @param address The memory start address.
	 * @param dataArray The data to write.
 	*/
	public async sendDzrpCmdWriteMem(address: number, dataArray: Buffer|Uint8Array): Promise<void> {
		assert(false);
	}


	/**
	 * Override.
	 * Sends the command to write a memory bank.
	 * @param bank 8k memory bank number.
	 * @param dataArray The data to write.
 	*/
	public async sendDzrpCmdWriteBank(bank: number, dataArray: Buffer|Uint8Array) {
		assert(false);
	}


}
