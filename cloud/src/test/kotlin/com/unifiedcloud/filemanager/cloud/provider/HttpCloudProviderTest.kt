package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.domain.model.FileQuery
import com.unifiedcloud.filemanager.domain.model.LocalAccountId
import com.unifiedcloud.filemanager.domain.model.ProviderFileId
import com.unifiedcloud.filemanager.domain.model.ProviderId
import com.unifiedcloud.filemanager.domain.model.TransferDestination
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayInputStream

class HttpCloudProviderTest {
    private lateinit var server: MockWebServer
    private lateinit var provider: HttpCloudProvider
    private val account = LocalAccountId(1L)

    private val parents =
        mapOf(
            ProviderFileId("child_folder") to ProviderFileId("parent_folder"),
        )

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        provider =
            HttpCloudProvider(
                providerId = ProviderId.GOOGLE_DRIVE,
                httpClient = OkHttpClient(),
                tokenProvider = { Result.success("test_bearer_token") },
                quotaGovernor = QuotaGovernor(),
                baseUrlOverride = server.url("/drive/v3").toString(),
                parentLookup = { parents[it] },
            )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `getQuotaInfo parses live storageQuota response`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"storageQuota":{"usage":"5242880","limit":"104857600"}}"""),
            )

            val result = provider.getQuotaInfo(account)
            assertTrue(result.isSuccess)
            val quota = result.getOrThrow()
            assertEquals(5_242_880L, quota.usedBytes)
            assertEquals(104_857_600L, quota.limitBytes)
        }

    @Test
    fun `listFiles parses files and nextPageToken and sends Bearer header`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(
                        """
                        {
                          "nextPageToken": "page_2",
                          "files": [
                            {
                              "id": "file_1",
                              "name": "Q4_Report.pdf",
                              "mimeType": "application/pdf",
                              "size": "2048",
                              "starred": true,
                              "trashed": false,
                              "webViewLink": "https://drive.google.com/file/d/file_1/view"
                            }
                          ]
                        }
                        """.trimIndent(),
                    ),
            )

            val result = provider.listFiles(FileQuery(accountId = account, parentFolderId = null))
            assertTrue(result.isSuccess)
            val page = result.getOrThrow()
            assertEquals("page_2", page.nextPageToken)
            assertEquals(1, page.items.size)
            assertEquals("Q4_Report.pdf", page.items.first().name)
            assertEquals("https://drive.google.com/file/d/file_1/view", page.items.first().webViewLink)

            val recorded = server.takeRequest()
            assertEquals("Bearer test_bearer_token", recorded.getHeader("Authorization"))
        }

    @Test
    fun `zero-byte upload completes with 0 of 0 progress without NaN or failure`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(
                        """
                        {
                          "id": "empty_1",
                          "name": "empty.txt",
                          "mimeType": "text/plain",
                          "size": "0"
                        }
                        """.trimIndent(),
                    ),
            )

            val progressUpdates = mutableListOf<Pair<Long, Long?>>()
            val result =
                provider.upload(
                    accountId = account,
                    source = ByteArrayInputStream(ByteArray(0)),
                    parentFolderId = null,
                    name = "empty.txt",
                    mimeType = "text/plain",
                    sizeBytes = 0L,
                    onProgress = { transferred, total ->
                        progressUpdates.add(transferred to total)
                    },
                )

            assertTrue(result.isSuccess)
            assertEquals(0L, result.getOrThrow().sizeBytes)
            assertTrue(progressUpdates.contains(0L to 0L))
        }

    @Test
    fun `move rejects moving a folder into itself or its descendant before making network request`() =
        runTest {
            val parent = ProviderFileId("parent_folder")
            val child = ProviderFileId("child_folder")

            val selfMove = provider.move(account, parent, parent)
            assertFalse(selfMove.isSuccess)

            val descendantMove = provider.move(account, parent, child)
            assertFalse(descendantMove.isSuccess)
            assertEquals(0, server.requestCount)
        }

    @Test
    fun `download streams bytes into ContentSource`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("hello-cloud-bytes"),
            )

            val destination =
                object : TransferDestination {
                    override val logLabel: String = "test-sink"
                }
            val result = provider.download(account, ProviderFileId("file_1"), destination)
            assertTrue(result.isSuccess)
            val content = result.getOrThrow().use { it.openStream().readBytes().decodeToString() }
            assertEquals("hello-cloud-bytes", content)
        }
}
