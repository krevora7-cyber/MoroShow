import { BaseClient } from './base.js';
import { Endpoints } from './endpoint.js';

export class DramaboxClient extends BaseClient {
    constructor(options = {}) {
        super(options);
    }

    async ping() {
        try {
            const token = await this.getToken();
            return this.buildResponse(true, {
                token: token.token.substring(0, 30) + '...',
                deviceId: token.deviceId,
                androidId: token.androidId,
                expiry: new Date(token.expiry).toISOString(),
                timestamp: Date.now()
            });
        } catch (error) {
            return this.handleError(error, 'ping');
        }
    }

    async getLatest(pageNo = 1) {
        try {
            const cacheKey = this.getCacheKey('latest', pageNo);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.THEATER, {
                newChannelStyle: 1,
                isNeedRank: 1,
                pageNo,
                index: 1,
                channelId: 48
            });

            const columnVoList = data?.data?.columnVoList || [];
            const results = [];

            columnVoList.forEach((column) => {
                if (column.bookList && Array.isArray(column.bookList)) {
                    column.bookList.forEach((book) => {
                        results.push({
                            id: book.bookId,
                            bookId: book.bookId,
                            bookName: book.bookName,
                            cover: book.cover,
                            coverWap: book.coverWap,
                            introduction: book.introduction,
                            chapterCount: book.chapterCount,
                            playCount: book.playCount,
                            tagV3s: book.tagV3s || [],
                            status: book.isEnd === 1 ? 'completed' : 'ongoing',
                            corner: book.corner
                        });
                    });
                }
            });

            const responseData = {
                page: pageNo,
                total: results.length,
                results
            };

            this.setCached(cacheKey, responseData);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch latest dramas');
        }
    }

    async getVip() {
        try {
            const cacheKey = this.getCacheKey('vip');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.THEATER, {
                homePageStyle: 0,
                isNeedRank: 1,
                index: 4,
                type: 0,
                channelId: 205
            });

            const columnVoList = data?.data?.columnVoList || [];
            const results = [];

            columnVoList.forEach((column) => {
                if (column.bookList && Array.isArray(column.bookList)) {
                    column.bookList.forEach((book) => {
                        results.push({
                            id: book.bookId,
                            bookId: book.bookId,
                            bookName: book.bookName,
                            cover: book.cover,
                            coverWap: book.coverWap,
                            introduction: book.introduction,
                            chapterCount: book.chapterCount,
                            playCount: book.playCount,
                            tagV3s: book.tagV3s || [],
                            status: book.isEnd === 1 ? 'completed' : 'ongoing',
                            corner: book.corner
                        });
                    });
                }
            });

            const responseData = {
                total: results.length,
                results
            };

            this.setCached(cacheKey, responseData);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch VIP dramas');
        }
    }

    async getDramaDetail(bookId) {
        try {
            if (!bookId) {
                return this.buildResponse(false, null, 'Book ID is required');
            }

            const cacheKey = this.getCacheKey('detail', bookId);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.DETAIL, {
                needRecommend: true,
                from: 'book_album',
                bookId
            });

            const bookData = data?.data?.book;
            if (!bookData) {
                // Not every bookId is indexed on this endpoint even though
                // it exists elsewhere in the catalog (e.g. it shows up in
                // listings, or chapterv2/batch/load works fine for it).
                // The v2 (webfic) detail endpoint covers a different slice
                // of the catalog, so fall back to that before giving up.
                return this.getDramaDetailFromV2Fallback(bookId, cacheKey);
            }

            const detail = {
                bookId: bookData.bookId,
                bookName: bookData.bookName,
                coverWap: bookData.coverWap,
                introduction: bookData.introduction,
                tagV3s: bookData.tagV3s || [],
                chapterCount: bookData.chapterCount,
                playCount: bookData.playCount,
                isEnd: bookData.isEnd,
                payChapterNum: bookData.payChapterNum,
                totalEpisodes: bookData.totalEpisodes,
                corner: bookData.corner
            };

            const recommendList = data?.data?.recommendList?.records || [];
            const recommendations = recommendList.map((item) => ({
                id: item.bookId,
                bookId: item.bookId,
                bookName: item.bookName,
                cover: item.cover,
                coverWap: item.coverWap,
                introduction: item.introduction,
                chapterCount: item.chapterCount,
                playCount: item.playCount,
                tagV3s: item.tagV3s || [],
                status: item.isEnd === 1 ? 'completed' : 'ongoing',
                corner: item.corner
            }));

            const responseData = {
                detail,
                recommendations
            };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch drama detail');
        }
    }

    async getDramaDetailFromV2Fallback(bookId, cacheKey) {
        try {
            let v2 = await this.getDramaDetailV2(bookId);

            // The webfic v2 endpoint has been observed to occasionally
            // return an empty result for a bookId that succeeds moments
            // later - one quick retry before giving up.
            if (!v2.success) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                v2 = await this.getDramaDetailV2(bookId);
            }

            const book = v2?.data?.drama;

            if (!v2.success || !book) {
                return this.buildResponse(false, null, 'Drama not found');
            }

            const detail = {
                bookId: book.bookId || bookId,
                bookName: book.bookName,
                coverWap: book.coverWap || book.cover,
                introduction: book.introduction,
                tagV3s: book.tagV3s || [],
                chapterCount: book.chapterCount ?? v2.data.chapters?.length ?? 0,
                playCount: book.playCount,
                isEnd: book.isEnd,
                payChapterNum: book.payChapterNum,
                totalEpisodes: book.totalEpisodes ?? v2.data.chapters?.length,
                corner: book.corner
            };

            // The v2 endpoint doesn't return a recommendation list the way
            // v1 does, so this comes back empty rather than failing outright.
            const responseData = { detail, recommendations: [] };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch drama detail');
        }
    }

    async getChapters(bookId) {
        try {
            if (!bookId) {
                return this.buildResponse(false, null, 'Book ID is required');
            }

            const cacheKey = this.getCacheKey('chapters', bookId);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.BATCH_LOAD, {
                boundaryIndex: 0,
                comingPlaySectionId: -1,
                index: 1,
                currencyPlaySource: 'discover_new_rec_new',
                needEndRecommend: 0,
                currencyPlaySourceName: '',
                preLoad: false,
                rid: '',
                pullCid: '',
                loadDirection: 0,
                bookId
            });

            const chapterList = data?.data?.chapterList || [];
            const chapters = chapterList.map((chapter) => {
                const cdn = chapter.cdnList?.find((c) => c.isDefault === 1) || chapter.cdnList?.[0];
                const videoPathList = cdn?.videoPathList || [];
                const videoPathItem = videoPathList.find((v) => v.isDefault === 1) || videoPathList[0];

                return {
                    chapterId: chapter.chapterId,
                    chapterIndex: chapter.chapterIndex,
                    chapterName: chapter.chapterName,
                    chapterIndexStr: chapter.chapterIndexStr,
                    duration: chapter.duration,
                    cover: chapter.cover,
                    cdnList: chapter.cdnList,
                    videoPath: videoPathItem?.videoPath,
                    isCharge: chapter.isCharge === 1,
                    isLocked: chapter.isCharge === 1
                };
            });

            const responseData = {
                bookId,
                totalChapters: data?.data?.chapterCount || 0,
                chapters
            };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch chapters');
        }
    }

    async getStreamUrl(bookId, episode) {
        try {
            if (!bookId || !episode) {
                return this.buildResponse(false, null, 'Book ID and episode are required');
            }

            const cacheKey = this.getCacheKey('stream', bookId, episode);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            // regexd.com (the previous source for this data) no longer
            // resolves, so this is built from the chapters endpoint instead,
            // which already carries a direct video path per episode.
            const chaptersResponse = await this.getChapters(bookId);
            if (!chaptersResponse.success || !chaptersResponse.data) {
                return this.buildResponse(false, null, 'Episode not found or locked');
            }

            const chapter = chaptersResponse.data.chapters.find(
                (c) => c.chapterIndex === episode || c.chapterIndex === Number(episode)
            );

            if (!chapter || !chapter.videoPath) {
                return this.buildResponse(false, null, 'Episode not found or locked');
            }

            const result = {
                status: 'success',
                apiBy: 'dramabox',
                data: {
                    bookId: bookId.toString(),
                    allEps: chaptersResponse.data.totalChapters,
                    chapter: {
                        id: chapter.chapterId,
                        index: chapter.chapterIndex,
                        indexCode: chapter.chapterIndexStr,
                        duration: chapter.duration,
                        cover: chapter.cover,
                        video: {
                            mp4: chapter.videoPath,
                            // No longer available now that regexd.com is
                            // gone - the chapters endpoint only exposes mp4.
                            m3u8: null
                        }
                    }
                }
            };

            this.setCached(cacheKey, result, 600);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'fetch stream URL');
        }
    }

    async getDramaList(pageNo = 1, pageSize = 10) {
        try {
            const cacheKey = this.getCacheKey('list', pageNo, pageSize);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.CLASSIFY, {
                typeList: pageNo == 1 ? [] : [
                    { type: 1, value: '' },
                    { type: 2, value: '' },
                    { type: 3, value: '' },
                    { type: 4, value: '' },
                    { type: 4, value: '' },
                    { type: 5, value: '1' }
                ],
                showLabels: false,
                pageNo: pageNo.toString(),
                pageSize: pageSize.toString()
            });

            const rawList = data?.data?.classifyBookList?.records || [];
            const isMore = data?.data?.classifyBookList?.isMore || 0;

            const list = rawList.flatMap((item) => {
                if (item.cardType === 3 && item.tagCardVo?.tagBooks) {
                    return item.tagCardVo.tagBooks;
                }
                return [item];
            });

            const uniqueList = list.filter(
                (v, i, arr) => arr.findIndex((b) => b.bookId === v.bookId) === i
            );

            const books = uniqueList.map((book) => ({
                id: book.bookId,
                name: book.bookName,
                cover: book.coverWap,
                chapterCount: book.chapterCount,
                introduction: book.introduction,
                tags: book.tagV3s,
                playCount: book.playCount,
                cornerName: book.corner?.name || null,
                cornerColor: book.corner?.color || null
            }));

            const result = {
                isMore: isMore == 1,
                book: books
            };

            this.setCached(cacheKey, result);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'fetch drama list');
        }
    }

    async getCategories(pageNo = 1, pageSize = 30) {
        try {
            const cacheKey = this.getCacheKey('categories', pageNo, pageSize);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.webficRequest(Endpoints.WEBFIC_BROWSE, {
                typeTwoId: 0,
                pageNo,
                pageSize
            });

            const categories = (data?.data?.types || []).map((item) => ({
                typeTwoId: item.typeTwoId,
                typeTwoName: item.typeTwoName,
                cover: item.cover,
                count: item.count
            }));

            this.setCached(cacheKey, categories, 1800);
            return this.buildResponse(true, categories);
        } catch (error) {
            return this.handleError(error, 'fetch categories');
        }
    }

    async getBooksByCategory(typeTwoId = 0, pageNo = 1, pageSize = 10) {
        try {
            const cacheKey = this.getCacheKey('category', typeTwoId, pageNo, pageSize);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.webficRequest(Endpoints.WEBFIC_BROWSE, {
                typeTwoId,
                pageNo,
                pageSize
            });

            const bookList = data?.data?.bookList || [];
            const books = bookList.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: book.isEnd === 1 ? 'completed' : 'ongoing',
                corner: book.corner
            }));

            this.setCached(cacheKey, books);
            return this.buildResponse(true, books);
        } catch (error) {
            return this.handleError(error, 'fetch books by category');
        }
    }

    async getRecommendedBooks() {
        try {
            const cacheKey = this.getCacheKey('recommend');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.RECOMMEND_BOOK, {
                isNeedRank: 1,
                newChannelStyle: 1,
                specialColumnId: 0,
                pageNo: 1,
                channelId: 43
            });

            const rawList = data?.data?.recommendList?.records || [];
            const list = rawList.flatMap((item) => {
                if (item.cardType === 3 && item.tagCardVo?.tagBooks) {
                    return item.tagCardVo.tagBooks;
                }
                return [item];
            });

            const uniqueList = list.filter(
                (v, i, arr) => arr.findIndex((b) => b.bookId === v.bookId) === i
            );

            const books = uniqueList.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: book.isEnd === 1 ? 'completed' : 'ongoing',
                corner: book.corner
            }));

            this.setCached(cacheKey, books);
            return this.buildResponse(true, books);
        } catch (error) {
            return this.handleError(error, 'fetch recommended books');
        }
    }

    async searchDramaIndex() {
        try {
            const cacheKey = this.getCacheKey('searchIndex');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.SEARCH_INDEX, {});
            const hotVideoList = data?.data?.hotVideoList || [];

            const results = hotVideoList.map((item) => ({
                bookId: item.bookId,
                bookName: item.bookName,
                cover: item.cover,
                introduction: item.introduction,
                playCount: item.playCount
            }));

            this.setCached(cacheKey, results, 180);
            return this.buildResponse(true, results);
        } catch (error) {
            return this.handleError(error, 'fetch search index');
        }
    }

    async searchDrama(keyword, pageNo = 1, pageSize = 20) {
        try {
            if (!keyword || keyword.trim() === '') {
                return this.buildResponse(false, null, 'Keyword is required');
            }

            const cacheKey = this.getCacheKey('search', keyword, pageNo, pageSize);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.SEARCH, {
                searchSource: '搜索按钮',
                pageNo,
                pageSize,
                from: 'search_sug',
                keyword
            });

            const rawResult = data?.data?.searchList || [];
            const isMore = data?.data?.isMore;

            const books = rawResult.map((book) => ({
                id: book.bookId,
                name: book.bookName,
                cover: book.cover,
                introduction: book.introduction,
                tags: book.tagNames || [],
                playCount: book.playCount
            }));

            const result = {
                isMore: isMore == 1,
                book: books
            };

            this.setCached(cacheKey, result, 180);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'search drama');
        }
    }

    async suggestSearch(keyword) {
        try {
            if (!keyword || keyword.trim() === '') {
                return this.buildResponse(false, null, 'Keyword is required');
            }

            const cacheKey = this.getCacheKey('suggest', keyword);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.SEARCH_SUGGEST, { keyword });

            const suggestList = data?.data?.suggestList || [];
            const results = suggestList.map((item) => ({
                bookId: item.bookId,
                bookName: item.bookName.replace(/\s+/g, '-'),
                cover: item.cover,
                introduction: item.introduction
            }));

            this.setCached(cacheKey, results, 180);
            return this.buildResponse(true, results);
        } catch (error) {
            return this.handleError(error, 'search suggest');
        }
    }

    async getForYou(pageNo = 1) {
        try {
            const cacheKey = this.getCacheKey('foryou', pageNo);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.RECOMMEND_BOOK, {
                isNeedRank: 1,
                specialColumnId: 0,
                pageNo: pageNo
            });

            const records = data?.data?.recommendList?.records || [];
            const items = records.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover || book.coverWap,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: book.isEnd === 1 ? 'completed' : 'ongoing'
            }));

            const result = {
                items,
                pagination: { currentPage: pageNo }
            };

            this.setCached(cacheKey, result);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'fetch for you recommendations');
        }
    }

    async getDubIndo(classify = '1', page = 1, pageSize = 15) {
        try {
            const cacheKey = this.getCacheKey('dubindo', classify, page, pageSize);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.CLASSIFY, {
                typeList: [
                    { type: 1, value: '' },
                    { type: 2, value: '1' },
                    { type: 3, value: '' },
                    { type: 4, value: '' },
                    { type: 4, value: '' },
                    { type: 5, value: classify }
                ],
                showLabels: false,
                pageNo: page,
                pageSize
            });

            const records = data?.data?.classifyBookList?.records || [];
            const items = records.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover || book.coverWap,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: book.isEnd === 1 ? 'completed' : 'ongoing'
            }));

            const result = {
                items,
                pagination: {
                    currentPage: page,
                    hasNext: data?.data?.classifyBookList?.isMore !== 0,
                    pageSize
                }
            };

            this.setCached(cacheKey, result);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'fetch dubbed Indonesian dramas');
        }
    }

    async getRandomDrama() {
        try {
            const cacheKey = this.getCacheKey('random');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const pageNo = Math.floor(Math.random() * 2) + 1;
            const data = await this.sapiRequest(Endpoints.RECOMMEND_CHANNEL, {
                pageNo,
                pageFlag: '',
                startType: 0,
                firstStartUp: false
            });

            const list = data?.data?.chapterList || [];
            const items = list.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover || book.coverWap,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: book.isEnd === 1 ? 'completed' : 'ongoing'
            }));

            const randomItem = items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
            this.setCached(cacheKey, randomItem);
            return this.buildResponse(true, randomItem);
        } catch (error) {
            return this.handleError(error, 'fetch random drama');
        }
    }

    async getComingSoon() {
        try {
            const cacheKey = this.getCacheKey('comingsoon');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.RESERVE_BOOK, {});

            const list = data?.data?.reserveBookList || [];
            const items = list.map((book) => ({
                id: book.bookId,
                bookId: book.bookId,
                bookName: book.bookName,
                cover: book.cover || book.coverWap,
                coverWap: book.coverWap,
                introduction: book.introduction,
                chapterCount: book.chapterCount,
                playCount: book.playCount,
                tagV3s: book.tagV3s || [],
                status: 'coming_soon'
            }));

            this.setCached(cacheKey, items);
            return this.buildResponse(true, items);
        } catch (error) {
            return this.handleError(error, 'fetch coming soon dramas');
        }
    }

    async getPopularSearch() {
        try {
            const cacheKey = this.getCacheKey('popularSearch');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.RANK, { rankType: 2 });

            const list = data?.data?.rankList || [];
            const items = list.map((item) => ({
                id: item.bookId,
                bookId: item.bookId,
                bookName: item.bookName,
                cover: item.cover || item.coverWap,
                coverWap: item.coverWap,
                introduction: item.introduction,
                chapterCount: item.chapterCount,
                playCount: item.playCount,
                tagV3s: item.tagV3s || [],
                status: item.isEnd === 1 ? 'completed' : 'ongoing'
            }));

            this.setCached(cacheKey, items);
            return this.buildResponse(true, items);
        } catch (error) {
            return this.handleError(error, 'fetch popular search');
        }
    }

    async getTrending() {
        try {
            const cacheKey = this.getCacheKey('trending');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.sapiRequest(Endpoints.THEATER, {
                newChannelStyle: 1,
                isNeedRank: 1,
                pageNo: 1,
                index: 0,
                channelId: 175
            });

            const columnVoList = data?.data?.columnVoList || [];
            const results = [];

            columnVoList.forEach((column) => {
                if (column.bookList && Array.isArray(column.bookList)) {
                    column.bookList.forEach((book) => {
                        results.push({
                            id: book.bookId,
                            bookId: book.bookId,
                            bookName: book.bookName,
                            cover: book.cover,
                            coverWap: book.coverWap,
                            introduction: book.introduction,
                            chapterCount: book.chapterCount,
                            playCount: book.playCount,
                            tagV3s: book.tagV3s || [],
                            status: book.isEnd === 1 ? 'completed' : 'ongoing',
                            corner: book.corner
                        });
                    });
                }
            });

            const responseData = {
                total: results.length,
                results: results.slice(0, 20)
            };

            this.setCached(cacheKey, responseData);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch trending');
        }
    }

    async getHomepage() {
        try {
            const cacheKey = this.getCacheKey('homepage');
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const [latest, trending, recommended] = await Promise.all([
                this.getLatest(1),
                this.getTrending(),
                this.getRecommendedBooks()
            ]);

            const responseData = {
                latest: latest.data,
                trending: trending.data,
                recommended: recommended.data,
                timestamp: Date.now()
            };

            this.setCached(cacheKey, responseData);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch homepage');
        }
    }

    async getRelatedDramas(bookId) {
        try {
            if (!bookId) {
                return this.buildResponse(false, null, 'Book ID is required');
            }

            const cacheKey = this.getCacheKey('related', bookId);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const detail = await this.getDramaDetail(bookId);
            if (!detail.success || !detail.data) {
                return this.buildResponse(false, null, 'Failed to get drama detail');
            }

            const recommendations = detail.data.recommendations || [];
            const responseData = {
                bookId,
                total: recommendations.length,
                results: recommendations.slice(0, 10)
            };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch related dramas');
        }
    }

    async getEpisodeDetails(bookId, episodeIndex) {
        try {
            if (!bookId || !episodeIndex) {
                return this.buildResponse(false, null, 'Book ID and episode index are required');
            }

            const cacheKey = this.getCacheKey('episode', bookId, episodeIndex);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const chapters = await this.getChapters(bookId);
            if (!chapters.success || !chapters.data) {
                return this.buildResponse(false, null, 'Failed to get chapters');
            }

            const chapter = chapters.data.chapters.find((c) => c.chapterIndex === episodeIndex);
            if (!chapter) {
                return this.buildResponse(false, null, 'Episode not found');
            }

            const stream = await this.getStreamUrl(bookId, episodeIndex);

            const responseData = {
                bookId,
                episode: {
                    index: chapter.chapterIndex,
                    name: chapter.chapterName,
                    cover: chapter.cover,
                    duration: chapter.duration,
                    videoPath: chapter.videoPath,
                    stream: stream.data
                },
                nextEpisode: chapters.data.chapters.find((c) => c.chapterIndex === episodeIndex + 1),
                prevEpisode: chapters.data.chapters.find((c) => c.chapterIndex === episodeIndex - 1)
            };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'fetch episode details');
        }
    }

    async batchDownload(bookId) {
        try {
            if (!bookId) {
                return this.buildResponse(false, null, 'Book ID is required');
            }

            const cacheKey = this.getCacheKey('batch', bookId);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            let result = [];
            let totalChapters = 0;

            const fetchBatch = async (index, retryCount = 0) => {
                try {
                    const data = await this.sapiRequest(Endpoints.BATCH_LOAD, {
                        boundaryIndex: 0,
                        comingPlaySectionId: -1,
                        index: index,
                        currencyPlaySourceName: '首页发现_Untukmu_推荐列表',
                        rid: '',
                        enterReaderChapterIndex: 0,
                        loadDirection: 1,
                        startUpKey: '10942710-5e9e-48f2-8927-7c387e6f5fac',
                        bookId: bookId,
                        currencyPlaySource: 'discover_175_rec',
                        needEndRecommend: 0,
                        preLoad: false,
                        pullCid: ''
                    });
                    return data;
                } catch (error) {
                    if (retryCount < 2) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        return fetchBatch(index, retryCount + 1);
                    }
                    throw error;
                }
            };

            const firstBatchData = await fetchBatch(1);
            if (firstBatchData?.data) {
                totalChapters = firstBatchData.data.chapterCount || 0;

                if (firstBatchData.data.chapterList) {
                    result.push(...firstBatchData.data.chapterList);
                }

                let currentIdx = 6;
                while (currentIdx <= totalChapters) {
                    const batchData = await fetchBatch(currentIdx);
                    const items = batchData?.data?.chapterList || [];
                    if (items.length > 0) {
                        result.push(...items);
                        currentIdx += 5;
                    } else {
                        currentIdx += 5;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const uniqueMap = new Map();
            result.forEach((item) => uniqueMap.set(item.chapterId, item));

            const finalResult = Array.from(uniqueMap.values())
                .sort((a, b) => (a.chapterIndex || 0) - (b.chapterIndex || 0))
                .map((ch) => {
                    let cdn = ch.cdnList?.find((c) => c.isDefault === 1) || ch.cdnList?.[0];
                    let videoPath = 'N/A';
                    if (cdn?.videoPathList) {
                        const preferred = cdn.videoPathList.find((v) => v.isDefault === 1) ||
                            cdn.videoPathList.find((v) => v.quality === 1080) ||
                            cdn.videoPathList.find((v) => v.quality === 720) ||
                            cdn.videoPathList[0];
                        videoPath = preferred?.videoPath || 'N/A';
                    }

                    return {
                        chapterId: ch.chapterId,
                        chapterIndex: ch.chapterIndex,
                        chapterName: ch.chapterName,
                        videoPath: videoPath
                    };
                });

            const responseData = {
                bookId,
                totalEpisodes: finalResult.length,
                episodes: finalResult
            };

            this.setCached(cacheKey, responseData, 600);
            return this.buildResponse(true, responseData);
        } catch (error) {
            return this.handleError(error, 'batch download');
        }
    }

    async getDramaDetailV2(bookId) {
        try {
            if (!bookId) {
                return this.buildResponse(false, null, 'Book ID is required');
            }

            const cacheKey = this.getCacheKey('detailv2', bookId);
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            const data = await this.webficRequest(
                `${Endpoints.WEBFIC_DETAIL}?id=${bookId}&language=${this.language}`,
                { id: bookId, language: this.language },
                'GET'
            );

            const { chapterList, book } = data?.data || {};

            if (!book) {
                // Don't cache this - an empty result here doesn't mean the
                // drama doesn't exist, it just means this particular call
                // didn't return it. Caching a "success" with nothing in it
                // would poison every call (including our own v1 -> v2
                // fallback) for the next 10 minutes.
                return this.buildResponse(false, null, 'Drama not found');
            }

            const chapters = [];
            chapterList?.forEach((ch) => {
                chapters.push({ index: ch.index, id: ch.id });
            });

            const result = { chapters, drama: book };
            this.setCached(cacheKey, result, 600);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'fetch drama detail v2');
        }
    }

    async advancedSearch(keyword, filters = {}) {
        try {
            const pageNo = filters?.pageNo || 1;
            const pageSize = filters?.pageSize || 20;
            const cacheKey = this.getCacheKey('advsearch', keyword || 'null', JSON.stringify(filters));
            const cached = this.getCached(cacheKey);
            if (cached) {
                return this.buildResponse(true, cached);
            }

            let data;
            if (keyword) {
                data = await this.sapiRequest(Endpoints.SEARCH, {
                    searchSource: '搜索按钮',
                    pageNo,
                    pageSize,
                    from: 'search_sug',
                    keyword
                });
            } else {
                data = await this.sapiRequest(Endpoints.CLASSIFY, {
                    typeList: filters?.type ? [{ type: 1, value: filters.type }] : [],
                    showLabels: false,
                    pageNo: pageNo.toString(),
                    pageSize: pageSize.toString()
                });
            }

            const rawResult = data?.data?.searchList || data?.data?.classifyBookList?.records || [];
            const isMore = data?.data?.isMore || data?.data?.classifyBookList?.isMore || 0;

            const books = rawResult.map((book) => ({
                id: book.bookId,
                name: book.bookName,
                cover: book.cover || book.coverWap,
                introduction: book.introduction,
                tags: book.tagNames || book.tagV3s || [],
                playCount: book.playCount,
                chapterCount: book.chapterCount
            }));

            const result = {
                isMore: isMore == 1,
                page: pageNo,
                pageSize: pageSize,
                total: books.length,
                filters: filters,
                results: books
            };

            this.setCached(cacheKey, result);
            return this.buildResponse(true, result);
        } catch (error) {
            return this.handleError(error, 'advanced search');
        }
    }

    getConfig() {
        return this.buildResponse(true, {
            language: this.language,
            timeout: this.timeout,
            maxRetries: this.maxRetries,
            requestDelay: this.requestDelay
        });
    }

    clearCache() {
        super.clearCache();
        return this.buildResponse(true, null, 'Cache cleared successfully');
    }

    getCacheStats() {
        const stats = super.getCacheStats();
        return this.buildResponse(true, stats);
    }
}

export default DramaboxClient;
