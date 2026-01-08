/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface RTCConnectionVideoEventArgs {
    guildId: string;
    channelId: string;
    userId: string;
    streamId: number;
    context: string;
}

export interface StreamStartEventArgs {
    appContext: string;
    audioSourceId: string;
    channelId: string;
    guildId: string;
    previewDisabled: boolean;
    sound: boolean;
    sourceId: string;
    sourceName: string;
    streamType: string;
    type: string;
}

export interface Stream {
    channelId: string;
    guildId: string;
    ownerId: string;
    state: string;
    streamType: string;
}

export interface FrameData {
    data: ImageDataArray;
    width: number;
    height: number;
}
