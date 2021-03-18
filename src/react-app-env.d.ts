/// <reference types="react-scripts" />

declare module 'react-speech-kit';

interface SDSContext {
    recResult: string;
    nluData: any;
    ttsAgenda: string;
    piece: string;
    degree: number;
    direction: string;
    mode: string;
    moves: number;
    help_msg: string;
    image: string;
}

type SDSEvent =
    | { type: 'CLICK' }
    | { type: 'SETTINGS' }
    | { type: 'WIN' }
    | { type: 'CONTINUE' }
    | { type: 'LOSE' }
    | { type: 'RECOGNISED' }
    | { type: 'DONE' }
    | { type: 'ASRRESULT', value: string }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'SPEAK', value: string };
