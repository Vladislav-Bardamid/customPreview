/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Stream } from "./types";

export function streamToStreamKey(stream: Stream) {
    return `${stream.streamType}:${stream.guildId}:${stream.channelId}:${stream.ownerId}`;
}
