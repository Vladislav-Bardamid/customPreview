/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { getUserSettingLazy } from "@api/UserSettings";
import { ScreenshareIcon } from "@components/index";
import definePlugin from "@utils/types";
import { chooseFile } from "@utils/web";
import { User } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { Constants, FluxDispatcher, Menu, RestAPI, UserStore } from "@webpack/common";

import { FrameData, RTCConnectionVideoEventArgs, Stream } from "./types";
import { streamToStreamKey } from "./utils";

const ApplicationStreamingStore = findStoreLazy("ApplicationStreamingStore");
const disableStreamPreviews = getUserSettingLazy<boolean>("voiceAndVideo", "disableStreamPreviews")!;

const maxWidth = 512;
const maxHeight = 512;

let retryUpdate: any | undefined;
let streamId: number;

export default definePlugin({
    name: "streamUtilities",
    description: "A set of utilities for managing and enhancing streaming functionality",
    authors: [/* Devs.Zorian*/],
    contextMenus: {
        "stream-context": streamContext,
        "manage-streams": streamsContext,
        "user-context": userContext
    },
    flux: {
        RTC_CONNECTION_VIDEO: (e: RTCConnectionVideoEventArgs) => {
            const myId = UserStore.getCurrentUser().id;

            if (e.context !== "stream" || e.userId !== myId) return;

            streamId = e.streamId;

            if (e.streamId) return;

            resetRetry();
        }
    }
});

async function uploadPreview(stream?: Stream) {
    const file = await chooseFile("image/*");
    if (!file) return;

    stream ??= ApplicationStreamingStore.getCurrentUserActiveStream();
    const streamKey = streamToStreamKey(stream!);

    const image = await createImageBitmap(file);

    updatePreview(streamKey, image);
}

async function uploadScreenPreview(stream?: Stream) {
    stream ??= ApplicationStreamingStore.getCurrentUserActiveStream();
    const streamKey = streamToStreamKey(stream!);

    const discordVoice = DiscordNative.nativeModules.requireModule("discord_voice");

    const frame = await discordVoice.getNextVideoOutputFrame(streamId) as FrameData;
    const imageData = new ImageData(frame.data, frame.width, frame.height);

    updatePreview(streamKey, imageData);
}

async function updatePreview(streamKey: string, data: ImageData | ImageBitmap) {
    const { width, height } = data;
    const isWidthLarge = width > maxWidth;
    const bitmap = await createImageBitmap(data, {
        resizeWidth: isWidthLarge ? maxWidth : undefined,
        resizeHeight: isWidthLarge ? undefined : maxHeight,
        resizeQuality: "high"
    });

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width ?? width;
    canvas.height = bitmap.height ?? height;

    const ctx = canvas.getContext("2d");
    ctx!.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    const imageData = canvas.toDataURL("image/jpeg");

    setLocalPreview(streamKey, imageData);
    postPreview(streamKey, imageData);

    const previewDisabled = disableStreamPreviews.getSetting();
    if (previewDisabled) return;

    disableStreamPreviews.updateSetting(true);
}

async function setLocalPreview(streamKey: string, imageData: string) {
    FluxDispatcher.dispatch({
        type: "STREAM_PREVIEW_FETCH_SUCCESS",
        streamKey: streamKey,
        previewURL: imageData
    });
}

async function postPreview(streamKey: string, imageData: string) {
    try {
        await RestAPI.post({
            url: Constants.Endpoints.STREAM_PREVIEW(streamKey),
            body: {
                thumbnail: imageData
            }
        });
    }
    catch (e: any) {
        if (e.status !== 429) throw e;

        const retryAfter = e.body.retry_after;

        resetRetry();

        retryUpdate = setTimeout(async () => {
            await postPreview(streamKey, imageData);
            retryUpdate = undefined;
        }, retryAfter);
    }
}

function resetRetry() {
    if (!retryUpdate) return;

    clearTimeout(retryUpdate);
    retryUpdate = undefined;
}

function streamContext(children, { stream }: { stream: Stream; }) {
    const myId = UserStore.getCurrentUser().id;
    if (stream.ownerId !== myId) return;

    const previewDisabled = disableStreamPreviews.getSetting();

    const disablePreviewItem = (
        <Menu.MenuCheckboxItem
            checked={!previewDisabled}
            label={"Preview Auto-Update"}
            id="preview-auto-update"
            action={() => disableStreamPreviews.updateSetting(!previewDisabled)}
        />
    );
    const customPreviewItem = (
        <Menu.MenuItem
            label="Upload Preview"
            id="upload-preview"
            icon={ScreenshareIcon}
            action={() => uploadPreview(stream)}
        />
    );
    const capturePreviewItem = (
        <Menu.MenuItem
            label="Capture Preview"
            id="capture-preview"
            icon={ScreenshareIcon}
            action={() => uploadScreenPreview(stream)}
        />
    );
    children.push(
        <Menu.MenuSeparator />,
        disablePreviewItem,
        <Menu.MenuSeparator />,
        customPreviewItem,
        capturePreviewItem
    );
}

function streamsContext(children, { activeStreams }: { activeStreams: Stream[]; }) {
    const stream = activeStreams[0];
    if (!stream) return;

    streamContext(children, { stream });
}

function userContext(children, { user }: { user: User; }) {
    const myId = UserStore.getCurrentUser().id;
    if (user.id !== myId) return;

    const stream = ApplicationStreamingStore.getCurrentUserActiveStream();
    if (!stream) return;

    streamContext(children, { stream });
}
