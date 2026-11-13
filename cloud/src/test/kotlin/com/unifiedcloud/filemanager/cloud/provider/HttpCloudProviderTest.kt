package com.unifiedcloud.filemanager.cloud.provider

import com.unifiedcloud.filemanager.cloud.google.quota.QuotaGovernor
import com.unifiedcloud.filemanager.domain.model.ByteRange
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
    fun `download and downloadRange stream bytes and send Range header`() =
        runTest {
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("hello-cloud-bytes"),
            )
            server.enqueue(
                MockResponse()
                    .setResponseCode(206)
                    .setBody("cloud"),
            )

            val destination =
                object : TransferDestination {
                    override val logLabel: String = "test-sink"
                }
            val result = provider.download(account, ProviderFileId("file_1"), destination)
            assertTrue(result.isSuccess)
            val content = result.getOrThrow().use { it.openStream().readBytes().decodeToString() }
            assertEquals("hello-cloud-bytes", content)
            server.takeRequest()

            val rangeResult = provider.downloadRange(account, ProviderFileId("file_1"), ByteRange(6L, 10L))
            assertTrue(rangeResult.isSuccess)
            val rangedBytes = rangeResult.getOrThrow().use { it.openStream().readBytes().decodeToString() }
            assertEquals("cloud", rangedBytes)
            val rangedReq = server.takeRequest()
            assertEquals("bytes=6-10", rangedReq.getHeader("Range"))
        }

    @Test
    fun `onedrive provider lists children and parses quota`() =
        runTest {
            val oneDrive =
                HttpCloudProvider(
                    providerId = ProviderId.ONE_DRIVE,
                    httpClient = OkHttpClient(),
                    tokenProvider = { Result.success("od_token") },
                    quotaGovernor = QuotaGovernor(),
                    baseUrlOverride = server.url("/me/drive").toString(),
                )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"quota":{"used":1024,"total":20480}}"""),
            )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"value":[{"id":"od_1","name":"Notes.docx","size":512}]}"""),
            )

            val quota = oneDrive.getQuotaInfo(account).getOrThrow()
            assertEquals(1_024L, quota.usedBytes)
            assertEquals(20_480L, quota.limitBytes)

            val files = oneDrive.listFiles(FileQuery(accountId = account, parentFolderId = null)).getOrThrow()
            assertEquals(1, files.items.size)
            assertEquals("Notes.docx", files.items.first().name)
            assertTrue(server.takeRequest().path?.contains("/me/drive") == true)
            assertTrue(server.takeRequest().path?.contains("/me/drive/root/children") == true)
        }

    @Test
    fun `dropbox provider parses folder entries and rejects unsupported trash or star operations`() =
        runTest {
            val dropbox =
                HttpCloudProvider(
                    providerId = ProviderId.DROPBOX,
                    httpClient = OkHttpClient(),
                    tokenProvider = { Result.success("dbx_token") },
                    quotaGovernor = QuotaGovernor(),
                    baseUrlOverride = server.url("/2").toString(),
                )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"used":4096,"allocation":{"allocated":16384}}"""),
            )
            val dropboxBody =
                """
                {
                  "entries": [
                    {
                      ".tag": "file",
                      "id": "id:abc",
                      "path_lower": "/spec.txt",
                      "name": "spec.txt",
                      "size": 128
                    }
                  ],
                  "has_more": false
                }
                """.trimIndent()
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody(dropboxBody),
            )

            val quota = dropbox.getQuotaInfo(account).getOrThrow()
            assertEquals(4_096L, quota.usedBytes)
            assertEquals(16_384L, quota.limitBytes)

            val page = dropbox.listFiles(FileQuery(accountId = account, parentFolderId = null)).getOrThrow()
            assertEquals(1, page.items.size)
            assertEquals("/spec.txt", page.items.first().ref.fileId.value)

            assertTrue(dropbox.trash(account, ProviderFileId("/spec.txt")).isFailure)
            assertTrue(dropbox.setStarred(account, ProviderFileId("/spec.txt"), true).isFailure)
        }

    @Test
    fun `box provider lists items and uploads multipart file`() =
        runTest {
            val box =
                HttpCloudProvider(
                    providerId = ProviderId.BOX,
                    httpClient = OkHttpClient(),
                    tokenProvider = { Result.success("box_token") },
                    quotaGovernor = QuotaGovernor(),
                    baseUrlOverride = server.url("/2.0").toString(),
                )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"space_used":256,"space_amount":8192}"""),
            )
            server.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"id":"box_99","name":"hello.txt","type":"file","size":5}"""),
            )

            val quota = box.getQuotaInfo(account).getOrThrow()
            assertEquals(256L, quota.usedBytes)
            assertEquals(8_192L, quota.limitBytes)

            val uploaded =
                box.upload(
                    accountId = account,
                    source = ByteArrayInputStream("hello".encodeToByteArray()),
                    parentFolderId = null,
                    name = "hello.txt",
                    mimeType = "text/plain",
                    sizeBytes = 5L,
                ).getOrThrow()
            assertEquals("box_99", uploaded.ref.fileId.value)
            assertEquals("hello.txt", uploaded.name)
        }
}
