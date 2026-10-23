package com.pocketpiano.app;

/** Independent reed variants, not recordings extracted from a game. */
final class DeltaHarmonicaSynth {
    private static final int RATE=48000,N=4096;
    private static final float[] SIN=new float[N];
    static {for(int i=0;i<N;i++)SIN[i]=(float)Math.sin(i*Math.PI*2/N);}
    private double phase,step,lfo;
    private float envelope,gain,filter,breath,cutoff;
    private long frames;
    private int variant,noise;
    private boolean active;
    void start(int preset,int pitch,int velocity){
        variant=preset-Instruments.DELTA_FIRST;phase=lfo=0;frames=0;envelope=1;filter=breath=0;
        step=440*Math.pow(2,(pitch-69)/12.0)/RATE;
        gain=.19f*(float)Math.sqrt(Math.max(1,Math.min(127,velocity))/127f);
        cutoff=new float[]{.21f,.09f,.36f,.12f,.07f,.19f}[variant];
        noise=0x1234567^pitch*131^variant*713;active=true;
    }
    boolean active(){return active;}
    void seek(long count){for(long i=0;i<count&&active;i++)next(false,1);}
    private static float sine(double p){return SIN[(int)((p-Math.floor(p))*N)&(N-1)];}
    float next(boolean released,float releaseMultiplier){
        if(!active)return 0;
        float flutter=sine(lfo);lfo+=5.1/RATE;
        double vibrato=frames>RATE/5?1+flutter*(variant==5?.0035:.0011):1;
        phase+=step*vibrato;if(phase>=1)phase-=Math.floor(phase);
        float signal=sine(phase)+sine(phase*2)*(variant==2?.48f:.27f)+sine(phase*3)*(variant==1?.08f:.17f);
        if(variant==4)signal=signal*.70f+sine(phase*.5)*.36f;
        if(variant==5)signal+=sine(phase*1.004+lfo*.007)*.32f;
        noise^=noise<<13;noise^=noise>>>17;noise^=noise<<5;
        float random=noise/(float)Integer.MAX_VALUE;breath+=.08f*(random-breath);
        signal+=breath*(variant==3?.23f:.055f);
        filter+=cutoff*(signal-filter);
        float attack=Math.min(1,frames/(float)(variant==3?2400:720));
        float swell=.62f+.38f*Math.min(1,frames/(float)(RATE*3.6));
        float output=filter*gain*attack*swell*envelope;
        frames++;if(released){envelope*=releaseMultiplier;if(envelope<.0001f)active=false;}
        return output;
    }
}
