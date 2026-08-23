// services/communityService.ts

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "@/constants/config.constants";

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
});

// ─── Attach JWT Token Automatically ──────────────────────────────────────────

api.interceptors.request.use(async (config: any) => {
    let token: string | null = null;

    try {
        token = await SecureStore.getItemAsync("authToken");
    } catch (_err) {
        // SecureStore may not be available on web
    }

    if (!token) {
        try {
            token =
                (await AsyncStorage.getItem("authToken")) ??
                (await AsyncStorage.getItem("token"));
        } catch (_err) {
            // AsyncStorage fallback
        }
    }

    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityPost {
    _id: string;
    authorUserId?: string | null;
    authorId?: string | null;
    username?: string;
    profileImage?: string;
    authorName?: string;
    title?: string;
    category?: string;
    content?: string;
    imageUrl?: string | null;
    submittedAt?: string;
    date?: string;
    likeCount: number;
    commentCount: number;
    isLiked: boolean;
    isSaved: boolean;
    isReported: boolean;
    isOwner: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CommunityLikeState {
    postId: string;
    isLiked: boolean;
    likeCount: number;
}

export interface CommunityComment {
    _id: string;
    postId: string;
    userId: string;
    parentCommentId?: string | null;
    username: string;
    profileImage: string;
    content: string;
    canDelete?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CommunityCommentsResponse {
    comments: CommunityComment[];
    commentCount: number;
}

export interface CommunitySaveState {
    postId: string;
    isSaved: boolean;
}

// ─── Create Community Post ────────────────────────────────────────────────────

export const createCommunityPost = async (
    data: FormData | Record<string, any>,
    imageUri?: string
): Promise<CommunityPost> => {
    let payload = data;
    if (!(data instanceof FormData) && imageUri) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        });
        const filename = imageUri.split("/").pop() ?? "photo.jpg";
        const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
        const mimeType = ext === "png" ? "image/png" : "image/jpeg";
        formData.append("image", {
            uri: imageUri,
            name: filename,
            type: mimeType,
        } as any);
        payload = formData;
    }

    const response = await api.post<any>(
        "/api/community/create",
        payload,
        data instanceof FormData || payload instanceof FormData
            ? { headers: { "Content-Type": "multipart/form-data" } }
            : undefined
    );

    const body = response.data;
    return body && body.data ? body.data : body;
};

// ─── Get Community Feed ───────────────────────────────────────────────────────

export const getCommunityFeed = async (): Promise<CommunityPost[]> => {
    const response = await api.get<any>(
        "/api/community"
    );

    const body = response.data;
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.data)) return body.data;
    return [];
};

// ─── Get Single Community Post ────────────────────────────────────────────────

export const getCommunityPost = async (
    id: string
): Promise<CommunityPost> => {
    const response = await api.get<any>(
        `/api/community/${id}`
    );

    const body = response.data;
    return body && body.data ? body.data : body;
};

export const updateCommunityPost = async (
    id: string,
    data: FormData | Record<string, unknown>
): Promise<CommunityPost> => {
    const response = await api.put<any>(`/api/community/${id}`, data,
        data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined);
    return response.data?.data ?? response.data;
};

export const deleteCommunityPost = async (id: string): Promise<void> => {
    await api.delete(`/api/community/${id}`);
};

const unwrapPostList = (body: any): CommunityPost[] =>
    Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);

export const getMyCommunityPosts = async (): Promise<CommunityPost[]> => {
    const response = await api.get<any>("/api/community/mine");
    return unwrapPostList(response.data);
};

export const getSavedCommunityPosts = async (): Promise<CommunityPost[]> => {
    const response = await api.get<any>("/api/community/saved");
    return unwrapPostList(response.data);
};

export const likeCommunityPost = async (id: string): Promise<CommunityLikeState> => {
    const response = await api.post<any>(`/api/community/${id}/like`);
    return response.data?.data ?? response.data;
};

export const unlikeCommunityPost = async (id: string): Promise<CommunityLikeState> => {
    const response = await api.delete<any>(`/api/community/${id}/like`);
    return response.data?.data ?? response.data;
};

export const saveCommunityPost = async (id: string): Promise<CommunitySaveState> => {
    const response = await api.post<any>(`/api/community/${id}/save`);
    return response.data?.data ?? response.data;
};

export const unsaveCommunityPost = async (id: string): Promise<CommunitySaveState> => {
    const response = await api.delete<any>(`/api/community/${id}/save`);
    return response.data?.data ?? response.data;
};

export const getCommunityComments = async (id: string): Promise<CommunityCommentsResponse> => {
    const response = await api.get<any>(`/api/community/${id}/comments`);
    return {
        comments: Array.isArray(response.data?.data) ? response.data.data : [],
        commentCount: Number(response.data?.commentCount) || 0,
    };
};

export const createCommunityComment = async (
    id: string,
    content: string,
    parentCommentId?: string | null
): Promise<{ comment: CommunityComment; commentCount: number }> => {
    const response = await api.post<any>(`/api/community/${id}/comments`, {
        content,
        parentCommentId: parentCommentId || undefined,
    });
    return {
        comment: response.data?.data,
        commentCount: Number(response.data?.commentCount) || 0,
    };
};

export const deleteCommunityComment = async (
    postId: string,
    commentId: string
): Promise<{ commentId: string; commentCount: number }> => {
    const response = await api.delete<any>(`/api/community/${postId}/comments/${commentId}`);
    return {
        commentId,
        commentCount: Number(response.data?.data?.commentCount) || 0,
    };
};

export const updateCommunityComment = async (
    postId: string,
    commentId: string,
    content: string
): Promise<CommunityComment> => {
    const response = await api.put<any>(`/api/community/${postId}/comments/${commentId}`, { content });
    return response.data?.data ?? response.data;
};

// ─── Report Community Post ────────────────────────────────────────────────────

export const reportCommunityPost = async (
    id: string,
    data?: string | Record<string, any>
) => {
    const payload = typeof data === "string" ? { reason: data } : (data ?? {});
    const response = await api.post<any>(
        `/api/community/${id}/report`,
        payload
    );

    const body = response.data;
    return body && body.data ? body.data : body;
};

export default api;
