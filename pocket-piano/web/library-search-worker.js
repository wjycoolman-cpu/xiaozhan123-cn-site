// Keep ranking and typo/alias behavior in the existing, shared implementation.
import {nativeSearch, nativeOrder} from '../demo/native-search.js';

const SECTIONS = {
  '流行歌曲': ['流行', '网络热门'], '动漫影视': ['动漫', '影视'],
  '经典轻音乐': ['轻音乐', '经典', '民乐'], '基础练习': ['儿歌', '练习曲']
};

export function filterLibraryRows(rows, category = '全部', favorites = new Set(), customRows = new Set()) {
  return rows.filter(row => category === '全部' ||
    category === '收藏' && favorites.has(row.id) ||
    category === '我的' && (row._custom || customRows.has(row) || row.category === '我的') ||
    category === '录制' && row.id.startsWith('record-') ||
    category === '内置' && (row.builtinIndex || row.builtinFile || row.category === '本机曲谱' || row.category === '内置') ||
    SECTIONS[category]?.includes(row.category) || row.category === category);
}

export function buildSearchIndex(catalog = [], local = []) {
  return [...nativeOrder(catalog), ...local];
}

export function searchIndex(rows, query, category, favorites) {
  return filterLibraryRows(nativeSearch(rows, query), category, new Set(favorites || []));
}

// Importing the module from library.js only shares the category predicate.
// No worker, fetch or index work starts in the main-thread module evaluation.
if (typeof document === 'undefined' && typeof self !== 'undefined' && self.addEventListener) {
  let revision = -1, rows = [], latest = null, scheduled = false;
  const reply = message => self.postMessage(message);
  self.addEventListener('message', event => {
    const message = event.data || {};
    try {
      if (message.type === 'index') {
        rows = buildSearchIndex(message.catalog, message.local);
        revision = message.revision;
        reply({type: 'indexed', revision, count: rows.length});
      } else if (message.type === 'search') {
        // Coalesce queued typing. A running nativeSearch is private to this
        // worker; stale replies are also rejected by the main-thread generation.
        latest = message;
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
          scheduled = false;
          const request = latest; latest = null;
          try {
            if (request.revision !== revision) throw Error('曲库搜索索引已更新');
            const result = searchIndex(rows, request.query, request.category, request.favorites);
            const slots = new Uint32Array(result.map(row => row._slot));
            self.postMessage({type: 'result', requestId: request.requestId,
              generation: request.generation, revision, slots}, [slots.buffer]);
          } catch (error) {
            reply({type: 'error', requestId: request.requestId, generation: request.generation,
              revision: request.revision, error: String(error?.message || error)});
          }
        }, 0);
      }
    } catch (error) {
      reply({type: 'error', requestId: message.requestId, generation: message.generation,
        revision: message.revision, error: String(error?.message || error)});
    }
  });
}
