/// <reference types="react-scripts" />

declare module 'react-speech-kit';

interface SDSContext {
    recResult: string;
    nluData: any;
    ttsAgenda: string;
    person: string,
    day: string,
    time: string,
    smarthome_action: any,
    help_msg: string,
    prompts: number
}

type SDSEvent =
    | { type: 'CLICK' }
    | { type: 'RECOGNISED' }
    | { type: 'DONE' }
    | { type: 'MAXSPEECH' }
    | { type: 'ASRRESULT', value: string }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'SPEAK', value: string };
