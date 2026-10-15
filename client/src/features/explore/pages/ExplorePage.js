import React, { useState, useEffect, useCallback } from 'react';
import exploreService from '../services/exploreService';
import ExploreHeader from '../components/ExploreHeader';
import ExploreFilterBar from '../components/ExploreFilterBar';
import ExploreContentGrid from '../components/ExploreContentGrid';
import ExploreContentCard from '../components/ExploreContentCard';
import { ExploreCardSkeletonGrid } from '../components/ExploreCardSkeleton';

const LIMIT = 9;

const ExplorePage = () => {
  const [items, setItems] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [contentType, setContentType] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchContent = useCallback(async (type, pageNum, append) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const params = { page: pageNum, limit: LIMIT };
      if (type !== 'all' && type !== 'featured') params.contentType = type;

      const response = await exploreService.getExploreContent(params);

      if (response.success) {
        setFeatured(response.data.featured || []);
        setItems((prev) => (append ? [...prev, ...response.data.items] : response.data.items));
        setHasMore(Boolean(response.data.pagination?.hasMore));
      } else {
        throw new Error(response.error?.message || 'Failed to load content');
      }
    } catch (err) {
      if (!append) {
        setError(err.message || 'Unable to load Explore content.');
      }
      // On a failed "Load More", keep existing content on screen - don't clear it.
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchContent(contentType, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const handleFilterChange = (type) => {
    if (type === contentType) return;
    setContentType(type);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchContent(contentType, nextPage, true);
  };

  const handleRetry = () => {
    fetchContent(contentType, 1, false);
  };

  const visibleItems = contentType === 'featured' ? featured : items;
  const isEmpty = !loading && !error && featured.length === 0 && items.length === 0;
  const hasVisibleContent = contentType === 'all'
    ? featured.length > 0 || items.length > 0
    : visibleItems.length > 0;
  const isFilteredEmpty = !loading && !error && !hasVisibleContent;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ExploreHeader />

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <ExploreFilterBar activeType={contentType} onChange={handleFilterChange} />

        <div className="min-w-0">
          {loading && <ExploreCardSkeletonGrid count={LIMIT} />}

          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-4">Unable to load Explore content.</p>
              <button
                type="button"
                onClick={handleRetry}
                className="px-6 py-2 bg-gaming-gold text-black font-medium rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (isEmpty || isFilteredEmpty) && (
            <div className="text-center py-16">
              <div className="text-3xl mb-3">Explore</div>
              <p className="text-gray-400">
                {contentType === 'all'
                  ? 'No content yet - check back soon.'
                  : 'No content in this category yet - try a different filter.'}
              </p>
            </div>
          )}

          {!loading && !error && !isEmpty && !isFilteredEmpty && (
            <>
              {contentType === 'all' && featured.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-lg font-semibold text-white mb-4">Featured</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {featured.slice(0, LIMIT).map((item) => (
                      <ExploreContentCard key={item._id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {visibleItems.length > 0 && (
                <>
                  <h2 className="text-lg font-semibold text-white mb-4">
                    {contentType === 'featured' ? 'Featured' : 'Latest'}
                  </h2>
                  <ExploreContentGrid
                    items={visibleItems}
                    onLoadMore={handleLoadMore}
                    hasMore={contentType !== 'featured' && hasMore}
                    loadingMore={loadingMore}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
