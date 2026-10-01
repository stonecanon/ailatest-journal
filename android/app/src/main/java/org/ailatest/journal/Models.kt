package org.ailatest.journal

import org.json.JSONArray
import org.json.JSONObject

data class Journal(
    val id: String,
    val name: String,
    val abbreviation: String = "",
    val issn: String = "",
    val eissn: String = "",
    val publisher: String = "",
    val country: String = "",
    val officialUrl: String = "",
    val impactFactor: Double? = null,
    val impactFactorYear: String = "",
    val fiveYearImpactFactor: Double? = null,
    val jci: Double? = null,
    val jcrYear: Int? = null,
    val quartile: String = "",
    val casZone: String = "",
    val casMajor: String = "",
    val indices: List<String> = emptyList(),
    val subjects: List<String> = emptyList(),
    val reviewMonths: Double? = null,
    val warning: Boolean = false,
    val onHold: Boolean = false,
    val underReview: Boolean = false,
    val citicWarning: Boolean = false,
    val openAccess: Boolean = false,
    val freeToPublish: Boolean = false,
    val apc: String = "",
    val apcFee: String = "",
    val license: String = "",
    val doajUrl: String = "",
    val crossrefSource: String = "",
)

data class SearchResponse(
    val total: Int,
    val page: Int,
    val items: List<Journal>,
)

data class Recommendation(
    val journal: Journal,
    val score: Double? = null,
    val tier: String = "",
    val explanation: String = "",
)

data class User(
    val id: Long,
    val email: String = "",
    val name: String = "",
    val login: String = "",
    val avatarUrl: String = "",
    val provider: String = "",
)

data class Entitlements(
    val tier: String = "free",
    val productTier: String = "free",
    val paidUntil: Long? = null,
    val trialExpiresAt: Long? = null,
    val favoritesEnabled: Boolean = false,
    val aiEnabled: Boolean = false,
    val aiCredits: Int? = null,
    val aiCreditsLimit: Int? = null,
    val publishFeeInfo: Boolean = false,
)

data class PickResponse(
    val recommendations: List<Recommendation> = emptyList(),
    val report: String = "",
    val remaining: Int? = null,
)

data class EmailLoginState(
    val email: String = "",
    val codeRequested: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
)

data class UiState(
    val query: String = "",
    val searchFilter: String = "",
    val searchResults: List<Journal> = emptyList(),
    val searchTotal: Int = 0,
    val searchLoading: Boolean = false,
    val selectedJournal: Journal? = null,
    val pickInput: String = "",
    val pickLoading: Boolean = false,
    val pickResults: List<Recommendation> = emptyList(),
    val pickReport: String = "",
    val user: User? = null,
    val entitlements: Entitlements = Entitlements(),
    val favoriteIds: Set<String> = emptySet(),
    val favoriteJournals: List<Journal> = emptyList(),
    val isLoadingFavorites: Boolean = false,
    val emailLogin: EmailLoginState = EmailLoginState(),
    val error: String? = null,
    val message: String? = null,
)

internal fun JSONArray.toStringList(): List<String> = buildList {
    for (index in 0 until length()) {
        val value = opt(index)?.toString()?.trim().orEmpty()
        if (value.isNotEmpty()) add(value)
    }
}

internal fun JSONObject.optNullableString(key: String): String? =
    if (has(key) && !isNull(key)) optString(key).trim().takeIf { it.isNotEmpty() } else null

internal fun JSONObject.optNullableDouble(key: String): Double? =
    if (has(key) && !isNull(key)) optDouble(key).takeIf { it.isFinite() } else null

internal fun JSONObject.optNullableLong(key: String): Long? =
    if (has(key) && !isNull(key)) optLong(key).takeIf { it > 0L } else null

internal fun JSONObject.toJournal(): Journal {
    val id = optString("id").ifBlank { optString("issn") }.ifBlank { optString("eissn") }
    val casXr = optJSONObject("cas_xr")
    val doajValue = opt("doaj")
    val doaj = doajValue as? JSONObject
    val oa = optJSONObject("oa")
    val casZone = optString("cas_zone").ifBlank { casXr?.optString("zone").orEmpty() }
    val subjects = buildList {
        optJSONArray("wos_categories")?.toStringList()?.let(::addAll)
        optString("esi_category").trim().takeIf { it.isNotEmpty() }?.let(::add)
    }.distinct()
    return Journal(
        id = id,
        name = optString("name").ifBlank { "Unknown journal" },
        abbreviation = optString("abbr20"),
        issn = optString("issn"),
        eissn = optString("eissn"),
        publisher = optString("publisher"),
        country = optString("country"),
        officialUrl = optString("url").ifBlank { optString("official_url") }.ifBlank { optString("homepage") },
        impactFactor = optNullableDouble("if_latest") ?: optNullableDouble("if_2025")
            ?: optNullableDouble("if_2024"),
        impactFactorYear = optString("if_latest_year"),
        fiveYearImpactFactor = optNullableDouble("five_year_if"),
        jci = optNullableDouble("jci"),
        jcrYear = if (has("jcr_year") && !isNull("jcr_year")) optInt("jcr_year") else null,
        quartile = optString("if_quartile"),
        casZone = casZone,
        casMajor = optString("cas_major_cn").ifBlank { casXr?.optString("major_cn").orEmpty() },
        indices = optJSONArray("indices")?.toStringList().orEmpty(),
        subjects = subjects,
        reviewMonths = optNullableDouble("review_cycle_months"),
        warning = optBoolean("warning"),
        onHold = optBoolean("on_hold"),
        underReview = optBoolean("under_review"),
        citicWarning = optBoolean("citic_warning"),
        openAccess = doajValue is JSONObject || (doajValue != null && doajValue != JSONObject.NULL) || optBoolean("oaj"),
        freeToPublish = optBoolean("free"),
        apc = oa?.optString("apc").orEmpty().ifBlank { doaj?.optString("apc").orEmpty() },
        apcFee = oa?.optString("fee").orEmpty().ifBlank { doaj?.optString("fee").orEmpty() },
        license = oa?.optString("license").orEmpty().ifBlank { doaj?.optString("lic").orEmpty() },
        doajUrl = doaj?.optString("u").orEmpty().ifBlank { doaj?.optString("du").orEmpty() },
        crossrefSource = optJSONObject("crossref")?.optString("source").orEmpty(),
    )
}

internal fun JSONObject.toUser(): User = User(
    id = optLong("id"),
    email = optString("email"),
    name = optString("name").ifBlank { optString("login") },
    login = optString("login"),
    avatarUrl = optString("avatar_url"),
    provider = optString("provider"),
)

internal fun JSONObject.toEntitlements(): Entitlements {
    val features = optJSONObject("features") ?: JSONObject()
    val favorites = features.optJSONObject("favorites") ?: JSONObject()
    val ai = features.optJSONObject("ai") ?: JSONObject()
    val credits = optJSONObject("credits") ?: JSONObject()
    return Entitlements(
        tier = optString("tier", "free"),
        productTier = optString("product_tier", "free"),
        paidUntil = optNullableLong("paid_until"),
        trialExpiresAt = optNullableLong("trial_expires_at"),
        favoritesEnabled = favorites.optBoolean("enabled"),
        aiEnabled = ai.optBoolean("enabled"),
        aiCredits = if (credits.has("total") && !credits.isNull("total")) credits.optInt("total") else null,
        aiCreditsLimit = if (ai.has("monthly_credits")) ai.optInt("monthly_credits") else null,
        publishFeeInfo = features.optBoolean("publish_fee_info"),
    )
}

internal fun JSONObject.toRecommendation(): Recommendation {
    val journalJson = optJSONObject("journal") ?: this
    val explanation = optString("explanation")
        .ifBlank { optString("reason") }
        .ifBlank { optString("match_reason") }
    return Recommendation(
        journal = journalJson.toJournal(),
        score = optNullableDouble("score") ?: optNullableDouble("match_score"),
        tier = optString("tier").ifBlank { optString("group") },
        explanation = explanation,
    )
}
