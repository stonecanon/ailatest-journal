package org.ailatest.journal

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val statusCode: Int, override val message: String) : Exception(message)

class ApiClient(context: Context) {
    private val preferences = context.getSharedPreferences("ailatest_session", Context.MODE_PRIVATE)
    private val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')

    var token: String?
        get() = preferences.getString("token", null)
        private set(value) {
            preferences.edit().putString("token", value).apply()
        }

    fun clearSession() {
        preferences.edit().remove("token").apply()
    }

    suspend fun requestEmailCode(email: String) {
        request("/auth/email/request", "POST", JSONObject().put("email", email))
    }

    suspend fun verifyEmailCode(email: String, code: String): User {
        val response = request(
            "/auth/email/verify",
            "POST",
            JSONObject().put("email", email).put("code", code),
        )
        val receivedToken = response.optString("token").takeIf { it.isNotBlank() }
            ?: throw ApiException(500, "No login token returned")
        token = receivedToken
        return response.optJSONObject("user")?.toUser() ?: me()
    }

    suspend fun reviewerLogin(email: String, password: String): User {
        val response = request(
            "/auth/reviewer/login",
            "POST",
            JSONObject().put("email", email).put("password", password),
        )
        val receivedToken = response.optString("token").takeIf { it.isNotBlank() }
            ?: throw ApiException(500, "No login token returned")
        token = receivedToken
        return response.optJSONObject("user")?.toUser() ?: me()
    }

    suspend fun adoptOAuthToken(oauthToken: String): User {
        token = oauthToken
        return try {
            me()
        } catch (error: Throwable) {
            clearSession()
            throw error
        }
    }

    suspend fun me(): User = request("/me").toUser()

    suspend fun entitlements(): Entitlements = request("/me/entitlements").toEntitlements()

    suspend fun search(
        query: String,
        page: Int = 1,
        pageSize: Int = 20,
        index: String = "",
    ): SearchResponse {
        val params = buildList {
            add("q=${encode(query)}")
            add("page=$page")
            add("page_size=$pageSize")
            add("sort_by=${if (query.isBlank()) "if" else "relevance"}")
            if (index.isNotBlank()) add("indexes=${encode(index)}")
        }.joinToString("&")
        val response = request("/search?$params")
        val items = response.optJSONArray("items")?.let { array ->
            buildList { for (i in 0 until array.length()) add(array.optJSONObject(i)?.toJournal() ?: continue) }
        }.orEmpty()
        return SearchResponse(
            total = response.optInt("total"),
            page = response.optInt("page", page),
            items = items,
        )
    }

    suspend fun journal(id: String): Journal = request("/journal/${encodePath(id)}").toJournal()

    suspend fun journals(ids: Collection<String>): List<Journal> {
        if (ids.isEmpty()) return emptyList()
        // The Worker API intentionally keeps the public surface small. Fetching
        // individual details here also works against the Pages search API and
        // keeps the Android client independent of a second data contract.
        return coroutineScope {
            ids.take(100).map { id ->
                async { runCatching { journal(id) }.getOrNull() }
            }.awaitAll().filterNotNull()
        }
    }

    suspend fun favorites(): List<String> {
        val response = request("/favorites")
        return response.optJSONArray("favs")?.toStringList().orEmpty()
    }

    suspend fun putFavorites(ids: Collection<String>) {
        request("/favorites", "PUT", JSONObject().put("favs", JSONArray(ids.toList())))
    }

    suspend fun pick(query: String): PickResponse {
        val response = request(
            "/pick",
            "POST",
            JSONObject()
                .put("query", query)
                .put("language", "en")
                .put("ai_report", false)
                .put("limit", 60),
        )
        val resultArray = response.optJSONArray("results")
        val recommendations = resultArray?.let { array ->
            buildList { for (i in 0 until array.length()) add(array.optJSONObject(i)?.toRecommendation() ?: continue) }
        }.orEmpty()
        val quota = response.optJSONObject("quota")
        val remaining = quota?.let {
            if (it.has("remaining") && !it.isNull("remaining")) it.optInt("remaining") else null
        }
        val report = response.optJSONObject("report")?.let { reportObject ->
            reportObject.optString("summary").ifBlank { reportObject.toString() }
        } ?: response.optString("report")
        return PickResponse(recommendations, report, remaining)
    }

    suspend fun verifyPlayPurchase(
        productId: String,
        purchaseToken: String,
        packageName: String,
        orderId: String?,
    ): Boolean {
        val response = request(
            "/play/purchases/verify",
            "POST",
            JSONObject()
                .put("product_id", productId)
                .put("purchase_token", purchaseToken)
                .put("package_name", packageName)
                .putOpt("order_id", orderId),
        )
        return response.optBoolean("ok") && response.optBoolean("active", true)
    }

    private suspend fun request(path: String, method: String = "GET", body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 15_000
                readTimeout = 30_000
                useCaches = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "AILatestJournalAndroid/${BuildConfig.VERSION_NAME}")
                token?.takeIf { it.isNotBlank() }?.let { setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
            try {
                if (body != null) {
                    connection.outputStream.use { output -> output.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val payload = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                val json = runCatching { JSONObject(payload) }.getOrNull() ?: JSONObject()
                if (status !in 200..299) {
                    val message = json.optString("error").ifBlank {
                        json.optString("message").ifBlank { "Request failed ($status)" }
                    }
                    throw ApiException(status, message)
                }
                json
            } finally {
                connection.disconnect()
            }
        }

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())

    private fun encodePath(value: String): String =
        value.trim().replace("/", "%2F").replace("?", "%3F").replace("#", "%23")
}
