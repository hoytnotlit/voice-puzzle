import { MachineConfig, send, Action, assign } from "xstate";

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            on: { ENDSPEECH: "init" },
            entry: send((context) => ({
                type: "SPEAK",
                value: "Welcome here"
            })),
        }
    }
})