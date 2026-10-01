package org.ailatest.journal

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.android.billingclient.api.Purchase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class JournalViewModel(application: Application) : AndroidViewModel(application) {
    val api = ApiClient(application)

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            restoreSession()
            search("")
        }
    }

    fun updateQuery(value: String) {
        _state.value = _state.value.copy(query = value, error = null)
    }

    fun search(query: String = _state.value.query) {
        val cleanQuery = query.trim()
        updateQuery(query)
        viewModelScope.launch {
            _state.value = _state.value.copy(searchLoading = true, error = null)
            runCatching { api.search(cleanQuery, index = _state.value.searchFilter) }
                .onSuccess { response ->
                    _state.value = _state.value.copy(
                        searchLoading = false,
                        searchResults = response.items,
                        searchTotal = response.total,
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(searchLoading = false, error = readableError(error))
                }
        }
    }

    fun setSearchFilter(index: String) {
        _state.value = _state.value.copy(searchFilter = index)
        search()
    }

    fun openJournal(journal: Journal) {
        _state.value = _state.value.copy(selectedJournal = journal, error = null)
    }

    fun closeJournal() {
        _state.value = _state.value.copy(selectedJournal = null)
    }

    fun updatePickInput(value: String) {
        _state.value = _state.value.copy(pickInput = value, error = null)
    }

    fun runPick() {
        val query = _state.value.pickInput.trim()
        if (query.length < 6) {
            _state.value = _state.value.copy(error = "Enter a title, abstract, or research question first.")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(pickLoading = true, error = null, message = null)
            runCatching { api.pick(query) }
                .onSuccess { response ->
                    _state.value = _state.value.copy(
                        pickLoading = false,
                        pickResults = response.recommendations,
                        pickReport = response.report,
                        message = response.remaining?.let { "${it} recommendations left" },
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(pickLoading = false, error = readableError(error))
                }
        }
    }

    fun toggleFavorite(journal: Journal) {
        val current = _state.value
        if (current.user == null) {
            _state.value = current.copy(error = "Sign in to sync favorites across devices.")
            return
        }
        if (!current.entitlements.favoritesEnabled) {
            _state.value = current.copy(error = "Cloud favorites are included with Pro.")
            return
        }
        val next = current.favoriteIds.toMutableSet().apply {
            if (!add(journal.id)) remove(journal.id)
        }.toSet()
        _state.value = current.copy(favoriteIds = next, error = null)
        viewModelScope.launch {
            runCatching { api.putFavorites(next) }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        favoriteIds = current.favoriteIds,
                        error = readableError(error),
                    )
                }
                .onSuccess { loadFavorites() }
        }
    }

    fun loadFavorites() {
        if (_state.value.user == null) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoadingFavorites = true)
            runCatching {
                val ids = api.favorites()
                ids to api.journals(ids)
            }.onSuccess { (ids, journals) ->
                _state.value = _state.value.copy(
                    favoriteIds = ids.toSet(),
                    favoriteJournals = journals,
                    isLoadingFavorites = false,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(isLoadingFavorites = false, error = readableError(error))
            }
        }
    }

    fun requestEmailCode(email: String) {
        val clean = email.trim().lowercase()
        if (!Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(clean)) {
            _state.value = _state.value.copy(emailLogin = EmailLoginState(email, error = "Enter a valid email address."))
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(emailLogin = EmailLoginState(clean, isLoading = true))
            runCatching { api.requestEmailCode(clean) }
                .onSuccess {
                    _state.value = _state.value.copy(
                        emailLogin = EmailLoginState(clean, codeRequested = true),
                        message = "A six-digit code was sent to your email.",
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        emailLogin = EmailLoginState(clean, error = readableError(error)),
                    )
                }
        }
    }

    fun verifyEmailCode(code: String) {
        val email = _state.value.emailLogin.email
        if (email.isBlank() || !Regex("^\\d{6}$").matches(code.trim())) {
            _state.value = _state.value.copy(emailLogin = _state.value.emailLogin.copy(error = "Enter the six-digit code."))
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(emailLogin = _state.value.emailLogin.copy(isLoading = true, error = null))
            runCatching { api.verifyEmailCode(email, code.trim()) }
                .onSuccess { user ->
                    loadAccount(user, "Signed in successfully.")
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        emailLogin = _state.value.emailLogin.copy(isLoading = false, error = readableError(error)),
                    )
                }
        }
    }

    fun reviewerLogin(email: String, password: String) {
        val clean = email.trim().lowercase()
        if (clean.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(emailLogin = EmailLoginState(clean, error = "Enter the reviewer email and password."))
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(emailLogin = EmailLoginState(clean, isLoading = true))
            runCatching { api.reviewerLogin(clean, password) }
                .onSuccess { user -> loadAccount(user, "Signed in successfully.") }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        emailLogin = EmailLoginState(clean, error = readableError(error)),
                    )
                }
        }
    }

    fun completeOAuth(oauthToken: String) {
        if (oauthToken.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(message = "Finishing Google sign-in…", error = null)
            runCatching { api.adoptOAuthToken(oauthToken) }
                .onSuccess { user -> loadAccount(user, "Signed in successfully.") }
                .onFailure { error -> _state.value = _state.value.copy(error = readableError(error)) }
        }
    }

    fun signOut() {
        api.clearSession()
        _state.value = UiState(searchResults = _state.value.searchResults, searchTotal = _state.value.searchTotal)
    }

    fun refreshAccount() {
        viewModelScope.launch {
            val user = _state.value.user ?: return@launch
            runCatching {
                api.me() to api.entitlements()
            }.onSuccess { (_, entitlements) ->
                _state.value = _state.value.copy(entitlements = entitlements, message = "Access refreshed.")
                loadFavorites()
            }.onFailure { error -> _state.value = _state.value.copy(error = readableError(error)) }
        }
    }

    suspend fun verifyPurchase(purchase: Purchase): Boolean {
        val productId = purchase.products.firstOrNull() ?: return false
        return runCatching {
            val active = api.verifyPlayPurchase(
                productId = productId,
                purchaseToken = purchase.purchaseToken,
                packageName = BuildConfig.APPLICATION_ID,
                orderId = purchase.orderId,
            )
            if (active) {
                val entitlements = api.entitlements()
                _state.value = _state.value.copy(entitlements = entitlements, message = "Subscription synced to your account.")
            }
            active
        }.getOrElse { error ->
            _state.value = _state.value.copy(error = readableError(error))
            false
        }
    }

    private suspend fun restoreSession() {
        if (api.token.isNullOrBlank()) return
        runCatching {
            val user = api.me()
            val entitlements = api.entitlements()
            user to entitlements
        }.onSuccess { (user, entitlements) ->
            _state.value = _state.value.copy(user = user, entitlements = entitlements)
            loadFavorites()
        }.onFailure { api.clearSession() }
    }

    private fun loadAccount(user: User, message: String) {
        viewModelScope.launch {
            val entitlements = runCatching { api.entitlements() }.getOrDefault(Entitlements())
            _state.value = _state.value.copy(
                user = user,
                entitlements = entitlements,
                emailLogin = EmailLoginState(),
                error = null,
                message = message,
            )
            loadFavorites()
        }
    }

    private fun readableError(error: Throwable): String = when (error) {
        is ApiException -> error.message
        else -> error.message ?: "Something went wrong. Please try again."
    }
}
