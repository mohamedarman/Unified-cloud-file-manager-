package com.unifiedcloud.filemanager.domain.model

/**
 * Listing and search queries.
 *
 * Every query is account-scoped by construction: a query cannot be built without
 * an [LocalAccountId]. There is no "current account" anywhere in this type, which
 * is how the ambient-account failure mode is prevented structurally rather than
 * by review (I-1, I-2).
 */
data class FileQuery(
    val accountId: LocalAccountId,
    val parentFolderId: ProviderFileId?,
    val pageSize: Int = DEFAULT_PAGE_SIZE,
    val pageToken: String? = null,
    val sortOrder: SortOrder = SortOrder.MODIFIED_DESC,
) {
    init {
        require(pageSize in MIN_PAGE_SIZE..MAX_PAGE_SIZE) {
            "pageSize must be in $MIN_PAGE_SIZE..$MAX_PAGE_SIZE, was $pageSize"
        }
    }

    companion object {
        const val DEFAULT_PAGE_SIZE = 50
        const val MIN_PAGE_SIZE = 1
        const val MAX_PAGE_SIZE = 200
    }
}

data class SearchQuery(
    val accountId: LocalAccountId,
    val text: String,
    val pageSize: Int = FileQuery.DEFAULT_PAGE_SIZE,
    val pageToken: String? = null,
) {
    init {
        require(text.isNotBlank()) { "SearchQuery.text must not be blank" }
    }
}

enum class SortOrder {
    NAME_ASC,
    NAME_DESC,
    MODIFIED_ASC,
    MODIFIED_DESC,
    SIZE_DESC,
}

/**
 * A page of results plus the token needed to ask for the next one.
 *
 * [nextPageToken] being null is the definition of "no more results", so callers
 * never infer exhaustion from a short page. A provider may legitimately return
 * fewer items than requested and still have more.
 */
data class Page<T>(
    val items: List<T>,
    val nextPageToken: String?,
    val completeness: Completeness = Completeness.COMPLETE,
) {
    val hasMore: Boolean
        get() = nextPageToken != null

    companion object {
        fun <T> last(items: List<T>): Page<T> = Page(items, nextPageToken = null)
    }
}

data class SearchResultPage(
    val query: SearchQuery,
    val items: List<SearchHit>,
    val nextPageToken: String?,
    val completeness: Completeness = Completeness.COMPLETE,
) {
    val hasMore: Boolean
        get() = nextPageToken != null
}

data class SearchHit(
    val file: CloudFile,
    val matchSnippet: String? = null,
    val matchLocation: MatchLocation? = null,
)

enum class MatchLocation {
    NAME,
    CONTENT,
}

/**
 * Whether a result set is the whole truth.
 *
 * Search cannot be exhaustive across a user's Drive, so the app must be able to
 * say "these are the results I could reach" rather than implying completeness it
 * does not have (Architecture.md §6.1). This is an honesty property, not a
 * performance detail - hence a first-class field rather than a comment.
 */
enum class Completeness {
    /** Every matching item is present. */
    COMPLETE,

    /**
     * Results are bounded - a cap, a timeout, or a provider limit - and more may
     * exist. The UI must indicate this rather than presenting a closed list.
     */
    PARTIAL,

    /** Could not be determined. */
    UNKNOWN,
}
