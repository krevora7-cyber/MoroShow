declare module '@zhadev/dramabox' {
    export interface ApiResponse {
        success: boolean;
        creator: string;
        data: any;
        metadata: any;
        message: string | null;
    }

    export interface TokenData {
        token: string;
        deviceId: string;
        androidId: string;
        instanceId: string;
        afid: string;
        ins: string;
        timestamp: number;
        expiry: number;
    }

    export interface DramaItem {
        id: string;
        bookId: string;
        bookName: string;
        cover: string;
        coverWap: string;
        introduction: string;
        chapterCount: number;
        playCount: number;
        tagV3s: string[];
        status: string;
        corner?: {
            name: string;
            color: string;
        };
    }

    export interface ChapterItem {
        chapterId: string;
        chapterIndex: number;
        chapterName: string;
        chapterIndexStr: string;
        duration: number;
        cover: string;
        cdnList?: Array<{
            cdnId: string;
            isDefault: number;
            videoPathList: Array<{
                videoPath: string;
                quality: number;
                isDefault: number;
            }>;
        }>;
        videoPath?: string;
        isCharge?: boolean;
        isLocked?: boolean;
    }

    export interface DramaDetail {
        bookId: string;
        bookName: string;
        coverWap: string;
        introduction: string;
        tagV3s: string[];
        chapterCount: number;
        playCount: number;
        isEnd: number;
        payChapterNum: number;
        totalEpisodes: number;
        corner?: {
            name: string;
            color: string;
        };
    }

    export interface SearchResult {
        isMore: boolean;
        book: Array<{
            id: string;
            name: string;
            cover: string;
            introduction: string;
            tags: string[];
            playCount: number;
        }>;
    }

    export interface CategoryItem {
        typeTwoId: number;
        typeTwoName: string;
        cover: string;
        count: number;
    }

    export interface TheaterResponse {
        page: number;
        total: number;
        results: DramaItem[];
    }

    export interface ChaptersResponse {
        bookId: string;
        totalChapters: number;
        chapters: ChapterItem[];
    }

    export interface BatchDownloadResponse {
        bookId: string;
        totalEpisodes: number;
        episodes: Array<{
            chapterId: string;
            chapterIndex: number;
            chapterName: string;
            videoPath: string;
        }>;
    }

    export interface StreamResponse {
        status: string;
        apiBy: string;
        data: {
            bookId: string;
            allEps: number;
            chapter: {
                id: string;
                index: number;
                indexCode: string;
                duration: number;
                cover: string;
                video: {
                    mp4: string;
                    m3u8: string;
                };
            };
        };
    }

    export interface ScraperConfig {
        language?: string;
        version?: string;
        timeout?: number;
        maxRetries?: number;
        cacheTTL?: number;
        userAgent?: string;
        requestDelay?: number;
    }

    export class DramaboxClient {
        constructor(config?: ScraperConfig);
        
        ping(): Promise<ApiResponse>;
        getLatest(pageNo?: number): Promise<ApiResponse>;
        getVip(): Promise<ApiResponse>;
        getDramaDetail(bookId: string): Promise<ApiResponse>;
        getChapters(bookId: string): Promise<ApiResponse>;
        getStreamUrl(bookId: string, episode: number): Promise<ApiResponse>;
        getDramaList(pageNo?: number, pageSize?: number): Promise<ApiResponse>;
        getCategories(pageNo?: number, pageSize?: number): Promise<ApiResponse>;
        getBooksByCategory(typeTwoId?: number, pageNo?: number, pageSize?: number): Promise<ApiResponse>;
        getRecommendedBooks(): Promise<ApiResponse>;
        searchDramaIndex(): Promise<ApiResponse>;
        searchDrama(keyword: string, pageNo?: number, pageSize?: number): Promise<ApiResponse>;
        suggestSearch(keyword: string): Promise<ApiResponse>;
        getForYou(pageNo?: number): Promise<ApiResponse>;
        getDubIndo(classify?: string, page?: number, pageSize?: number): Promise<ApiResponse>;
        getRandomDrama(): Promise<ApiResponse>;
        getComingSoon(): Promise<ApiResponse>;
        getPopularSearch(): Promise<ApiResponse>;
        getTrending(): Promise<ApiResponse>;
        getHomepage(): Promise<ApiResponse>;
        getRelatedDramas(bookId: string): Promise<ApiResponse>;
        getEpisodeDetails(bookId: string, episodeIndex: number): Promise<ApiResponse>;
        batchDownload(bookId: string): Promise<ApiResponse>;
        getDramaDetailV2(bookId: string): Promise<ApiResponse>;
        advancedSearch(keyword?: string, filters?: {
            type?: string;
            status?: string;
            sort?: string;
            pageNo?: number;
            pageSize?: number;
        }): Promise<ApiResponse>;
        getConfig(): Promise<ApiResponse>;
        clearCache(): ApiResponse;
        getCacheStats(): ApiResponse;
    }

    export const config: {
        baseUrl: string;
        webficUrl: string;
        regexdUrl: string;
        defaultLanguage: string;
        version: string;
        userAgent: string;
        timeout: number;
        maxRetries: number;
        cacheTTL: number;
        tokenCacheTTL: number;
        requestDelay: number;
    };

    export function getConfig(): typeof config;
    export function updateConfig(newConfig: Partial<typeof config>): void;
}

export = Dramabox;
