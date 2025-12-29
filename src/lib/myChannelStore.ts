"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MyChannel } from '@/mock/myChannels';

interface MyChannelState {
    isConnected: boolean;
    channels: MyChannel[];
    setConnected: (connected: boolean) => void;
    setChannels: (channels: MyChannel[]) => void;
    toggleTracking: (channelId: string) => void;
    disconnect: () => void;
}

export const useMyChannelStore = create<MyChannelState>()(
    persist(
        (set) => ({
            isConnected: false,
            channels: [],
            setConnected: (connected: boolean) => set({ isConnected: connected }),
            setChannels: (channels: MyChannel[]) => set({ channels }),
            toggleTracking: (channelId: string) => set((state: MyChannelState) => ({
                channels: state.channels.map((ch: MyChannel) =>
                    ch.channelId === channelId ? { ...ch, trackingEnabled: !ch.trackingEnabled } : ch
                )
            })),
            disconnect: () => set({ isConnected: false, channels: [] }),
        }),
        {
            name: 'my-channel-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
