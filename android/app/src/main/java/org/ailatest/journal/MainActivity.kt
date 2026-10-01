package org.ailatest.journal

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

private val BrandGreen = Color(0xFF1F5F4A)
private val BrandGold = Color(0xFFC4A35A)
private val GroupedBackground = Color(0xFFF2F2F7)

class MainActivity : ComponentActivity() {
    private val viewModel: JournalViewModel by viewModels()
    private lateinit var billing: GooglePlayBilling

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        billing = GooglePlayBilling(this) { purchase -> viewModel.verifyPurchase(purchase) }
        handleOAuthIntent(intent)
        setContent {
            AILatestTheme {
                AILatestApp(
                    viewModel = viewModel,
                    billing = billing,
                    openGoogleLogin = ::openGoogleLogin,
                    openManageSubscriptions = ::openManageSubscriptions,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (::billing.isInitialized) billing.connectAndRestore()
    }

    override fun onDestroy() {
        if (::billing.isInitialized) billing.close()
        super.onDestroy()
    }

    private fun handleOAuthIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "ailatest" && data.host == "oauth") {
            data.getQueryParameter("token")?.let(viewModel::completeOAuth)
        }
    }

    private fun openGoogleLogin() {
        val redirect = Uri.encode("ailatest://oauth")
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.API_BASE_URL}/auth/google?redirect=$redirect")))
    }

    private fun openManageSubscriptions() {
        val uri = Uri.parse("https://play.google.com/store/account/subscriptions?package=${BuildConfig.APPLICATION_ID}")
        startActivity(Intent(Intent.ACTION_VIEW, uri))
    }
}

@Composable
private fun AILatestTheme(content: @Composable () -> Unit) {
    val dark = androidx.compose.foundation.isSystemInDarkTheme()
    val colors = if (dark) {
        androidx.compose.material3.darkColorScheme(
            primary = Color(0xFF8CC7A9),
            secondary = Color(0xFFE4C77F),
            background = Color.Black,
            surface = Color(0xFF1C1C1E),
        )
    } else {
        androidx.compose.material3.lightColorScheme(
            primary = BrandGreen,
            secondary = BrandGold,
            background = GroupedBackground,
            surface = Color.White,
        )
    }
    MaterialTheme(colorScheme = colors, typography = androidx.compose.material3.Typography(), content = content)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AILatestApp(
    viewModel: JournalViewModel,
    billing: GooglePlayBilling,
    openGoogleLogin: () -> Unit,
    openManageSubscriptions: () -> Unit,
) {
    val activity = LocalContext.current as ComponentActivity
    val state by viewModel.state.collectAsState()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var showLogin by rememberSaveable { mutableStateOf(false) }
    var showReviewerLogin by rememberSaveable { mutableStateOf(false) }
    var snackbarMessage by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error, state.message, billing.status) {
        snackbarMessage = state.error ?: state.message ?: billing.status
        snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            snackbarMessage = null
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
            ) {
                val items = listOf(
                    Triple("Discover", Icons.Outlined.Search, Icons.Filled.Search),
                    Triple("Recommend", Icons.Outlined.AutoAwesome, Icons.Filled.AutoAwesome),
                    Triple("Saved", Icons.Outlined.BookmarkBorder, Icons.Filled.Bookmark),
                    Triple("Account", Icons.Outlined.AccountCircle, Icons.Filled.AccountCircle),
                )
                items.forEachIndexed { index, item ->
                    NavigationBarItem(
                        selected = tab == index,
                        onClick = { tab = index },
                        icon = {
                            Icon(
                                imageVector = if (tab == index) item.third else item.second,
                                contentDescription = item.first,
                            )
                        },
                        label = { Text(item.first, fontSize = 11.sp) },
                    )
                }
            }
        },
    ) { padding ->
        when (tab) {
            0 -> DiscoverScreen(
                modifier = Modifier.padding(padding),
                state = state,
                onSearch = viewModel::search,
                onFilter = viewModel::setSearchFilter,
                onOpenJournal = viewModel::openJournal,
                onToggleFavorite = viewModel::toggleFavorite,
                onLogin = { showLogin = true },
            )
            1 -> RecommendScreen(
                modifier = Modifier.padding(padding),
                state = state,
                onInput = viewModel::updatePickInput,
                onRun = {
                    if (state.user == null) showLogin = true else viewModel.runPick()
                },
                onOpenJournal = viewModel::openJournal,
            )
            2 -> SavedScreen(
                modifier = Modifier.padding(padding),
                state = state,
                onLogin = { showLogin = true },
                onOpenAccount = { tab = 3 },
                onOpenJournal = viewModel::openJournal,
                onToggleFavorite = viewModel::toggleFavorite,
            )
            else -> AccountScreen(
                modifier = Modifier.padding(padding),
                state = state,
                billing = billing,
                onLogin = { showLogin = true },
                onReviewerLogin = { showReviewerLogin = true },
                onGoogleLogin = openGoogleLogin,
                onRefresh = { viewModel.refreshAccount(); billing.restorePurchases() },
                onBuy = { tier, plan ->
                    if (state.user == null) showLogin = true
                    else billing.buy(activity, tier, plan)
                },
                onManage = openManageSubscriptions,
                onSignOut = viewModel::signOut,
            )
        }
    }

    state.selectedJournal?.let { journal ->
        ModalBottomSheet(onDismissRequest = viewModel::closeJournal) {
            JournalDetailSheet(
                journal = journal,
                isFavorite = journal.id in state.favoriteIds,
                showPublishFees = state.entitlements.publishFeeInfo,
                onToggleFavorite = { viewModel.toggleFavorite(journal) },
            )
        }
    }

    if (showLogin) {
        ModalBottomSheet(onDismissRequest = { showLogin = false }) {
            LoginSheet(
                state = state,
                onGoogleLogin = openGoogleLogin,
                onRequestCode = viewModel::requestEmailCode,
                onVerifyCode = viewModel::verifyEmailCode,
                onOpenReviewerLogin = { showLogin = false; showReviewerLogin = true },
            )
        }
    }

    if (showReviewerLogin) {
        ModalBottomSheet(onDismissRequest = { showReviewerLogin = false }) {
            ReviewerLoginSheet(
                state = state,
                onReviewerLogin = viewModel::reviewerLogin,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverScreen(
    modifier: Modifier,
    state: UiState,
    onSearch: (String) -> Unit,
    onFilter: (String) -> Unit,
    onOpenJournal: (Journal) -> Unit,
    onToggleFavorite: (Journal) -> Unit,
    onLogin: () -> Unit,
) {
    var query by rememberSaveable(state.query) { mutableStateOf(state.query) }
    Column(modifier.fillMaxSize().imePadding()) {
        TopAppBar(
            title = {
                Column {
                    Text("Discover journals", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                    Text("Search the global directory", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        Column(Modifier.padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    VoiceSearchButton(onResult = { spoken ->
                        query = spoken
                        onSearch(spoken)
                    })
                },
                placeholder = { Text("Journal name, ISSN, or subject") },
                shape = RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSearch(query) }),
            )
            Spacer(Modifier.height(10.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    FilterChip(
                        selected = state.searchFilter.isBlank(),
                        onClick = { onFilter("") },
                        label = { Text("All") },
                    )
                }
                listOf("SCIE", "SSCI", "SCOPUS", "DOAJ").forEach { index ->
                    item {
                        FilterChip(
                            selected = state.searchFilter == index,
                            onClick = { onFilter(index) },
                            label = { Text(index) },
                        )
                    }
                }
            }
        }
        if (state.searchLoading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 10.dp))
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 14.dp, 16.dp, 100.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text(
                    if (state.searchTotal > 0) "${state.searchTotal} journals" else "Browse the latest directory",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            items(state.searchResults, key = { it.id }) { journal ->
                JournalCard(
                    journal = journal,
                    isFavorite = journal.id in state.favoriteIds,
                    onOpen = { onOpenJournal(journal) },
                    onToggleFavorite = { if (state.user == null) onLogin() else onToggleFavorite(journal) },
                )
            }
            if (!state.searchLoading && state.searchResults.isEmpty()) {
                item { EmptyState("No journals found", "Try an ISSN, title, or a broader keyword.") }
            }
        }
    }
}

@Composable
private fun VoiceSearchButton(onResult: (String) -> Unit) {
    val context = LocalContext.current
    val latestOnResult by rememberUpdatedState(onResult)
    val recognizer = remember(context) {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            SpeechRecognizer.createSpeechRecognizer(context)
        } else {
            null
        }
    }
    val speechIntent = remember {
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }
    }
    DisposableEffect(recognizer) {
        if (recognizer == null) return@DisposableEffect onDispose { }
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.takeIf { it.isNotBlank() }
                    ?.let(latestOnResult)
            }
            override fun onError(error: Int) = Unit
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        onDispose { recognizer.destroy() }
    }
    val requestPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) recognizer?.startListening(speechIntent)
    }
    IconButton(
        onClick = {
            if (recognizer == null) return@IconButton
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                recognizer.startListening(speechIntent)
            } else {
                requestPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        },
        enabled = recognizer != null,
    ) {
        Icon(Icons.Default.Mic, contentDescription = "Search by voice")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecommendScreen(
    modifier: Modifier,
    state: UiState,
    onInput: (String) -> Unit,
    onRun: () -> Unit,
    onOpenJournal: (Journal) -> Unit,
) {
    Column(modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text("Recommend", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                    Text("Match your paper to journals", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 100.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                OutlinedTextField(
                    value = state.pickInput,
                    onValueChange = onInput,
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 7,
                    maxLines = 12,
                    label = { Text("Title, abstract, or research question") },
                    placeholder = { Text("Paste a short description of your work…") },
                    shape = RoundedCornerShape(14.dp),
                )
            }
            item {
                Button(
                    onClick = onRun,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = !state.pickLoading,
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null)
                    Spacer(Modifier.size(8.dp))
                    Text(if (state.pickLoading) "Finding matches…" else "Find matching journals")
                }
            }
            if (state.pickLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (state.pickReport.isNotBlank()) {
                item {
                    ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Quick read", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text(state.pickReport, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
            if (state.pickResults.isNotEmpty()) {
                item { Text("Best matches", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                itemsIndexed(state.pickResults, key = { _, result -> result.journal.id }) { index, result ->
                    RecommendationCard(index + 1, result) { onOpenJournal(result.journal) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedScreen(
    modifier: Modifier,
    state: UiState,
    onLogin: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenJournal: (Journal) -> Unit,
    onToggleFavorite: (Journal) -> Unit,
) {
    Column(modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Saved", fontSize = 28.sp, fontWeight = FontWeight.Bold) },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        if (state.user == null) {
            EmptyState("Your saved journals", "Sign in to keep the same list on the website and Android.", "Sign in", onLogin)
            return
        }
        if (!state.entitlements.favoritesEnabled) {
            UpgradeCard("Cloud favorites are a Pro feature", "Save journals once and access them on every device.", "Open Account", onOpenAccount)
            return
        }
        if (state.isLoadingFavorites) LinearProgressIndicator(Modifier.fillMaxWidth())
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 100.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (state.favoriteJournals.isEmpty() && !state.isLoadingFavorites) {
                item { EmptyState("Nothing saved yet", "Tap the bookmark on a journal to add it here.") }
            }
            items(state.favoriteJournals, key = { it.id }) { journal ->
                JournalCard(
                    journal = journal,
                    isFavorite = true,
                    onOpen = { onOpenJournal(journal) },
                    onToggleFavorite = { onToggleFavorite(journal) },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountScreen(
    modifier: Modifier,
    state: UiState,
    billing: GooglePlayBilling,
    onLogin: () -> Unit,
    onReviewerLogin: () -> Unit,
    onGoogleLogin: () -> Unit,
    onRefresh: () -> Unit,
    onBuy: (String, String) -> Unit,
    onManage: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Account", fontSize = 28.sp, fontWeight = FontWeight.Bold) },
            actions = { IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Refresh") } },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 100.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.user == null) {
                item { LoginPrompt(onLogin, onGoogleLogin, onReviewerLogin) }
                item { Text("Your account connects website, Android, and saved data.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                return@LazyColumn
            }
            item {
                ElevatedCard {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AccountCircle, contentDescription = null, modifier = Modifier.size(52.dp), tint = BrandGreen)
                        Spacer(Modifier.size(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(state.user.name.ifBlank { state.user.email }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(state.user.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TierBadge(state.entitlements.productTier)
                    }
                }
            }
            item { AccessSummary(state.entitlements) }
            item {
                Text("Upgrade", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            item {
                if (billing.options.isEmpty()) {
                    Text("Subscription products will appear here when the Play Console catalog is live.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        listOf("pro" to "Pro", "max" to "Max").forEach { (tier, label) ->
                            val monthly = billing.options.firstOrNull { it.tier == tier && it.basePlanId == "monthly" }
                            val yearly = billing.options.firstOrNull { it.tier == tier && it.basePlanId == "yearly" }
                            if (monthly != null || yearly != null) {
                                SubscriptionCard(label, monthly, yearly, onBuy)
                            }
                        }
                    }
                }
            }
            item {
                OutlinedButton(onClick = onManage, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.ManageAccounts, contentDescription = null)
                    Spacer(Modifier.size(8.dp))
                    Text("Manage subscription in Google Play")
                }
            }
            item {
                TextButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
            }
        }
    }
}

@Composable
private fun JournalCard(
    journal: Journal,
    isFavorite: Boolean,
    onOpen: () -> Unit,
    onToggleFavorite: () -> Unit,
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                LetterMark(journal.name)
                Spacer(Modifier.size(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(journal.name, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (journal.abbreviation.isNotBlank()) Text(journal.abbreviation, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onToggleFavorite) {
                    Icon(if (isFavorite) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = "Save", tint = if (isFavorite) BrandGold else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), modifier = Modifier.padding(top = 10.dp)) {
                MetricPill("IF", journal.impactFactor?.let { if (it % 1 == 0.0) it.toInt().toString() else "%.2f".format(it) } ?: "—")
                MetricPill("JCR", journal.quartile.ifBlank { "—" })
                MetricPill("CAS", journal.casZone.ifBlank { "—" })
                if (journal.warning || journal.onHold || journal.underReview) MetricPill("Risk", "Review", danger = true)
            }
            if (journal.indices.isNotEmpty()) {
                Text(journal.indices.take(5).joinToString(" · "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}

@Composable
private fun RecommendationCard(number: Int, result: Recommendation, onOpen: () -> Unit) {
    ElevatedCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Surface(shape = CircleShape, color = BrandGreen.copy(alpha = 0.12f), modifier = Modifier.size(30.dp)) {
                Box(contentAlignment = Alignment.Center) { Text("$number", color = BrandGreen, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Text(result.journal.name, fontWeight = FontWeight.SemiBold)
                Text(
                    listOfNotNull(result.journal.impactFactor?.let { "IF $it" }, result.journal.quartile.takeIf { it.isNotBlank() }, result.journal.casZone.takeIf { it.isNotBlank() }).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (result.explanation.isNotBlank()) Text(result.explanation, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 5.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun JournalDetailSheet(
    journal: Journal,
    isFavorite: Boolean,
    showPublishFees: Boolean,
    onToggleFavorite: () -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Surface(Modifier.size(38.dp, 4.dp), RoundedCornerShape(2.dp), color = MaterialTheme.colorScheme.outlineVariant) {} }
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(journal.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(journal.publisher.ifBlank { journal.abbreviation }, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = onToggleFavorite) { Icon(if (isFavorite) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = "Save", tint = BrandGold) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricPill("IF", journal.impactFactor?.toString() ?: "—")
            MetricPill("JCR", journal.quartile.ifBlank { "—" })
            MetricPill("CAS", journal.casZone.ifBlank { "—" })
        }
        Divider()
        DetailLine("ISSN", listOf(journal.issn, journal.eissn).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "—" })
        DetailLine("Country / publisher", listOf(journal.country, journal.publisher).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "—" })
        DetailLine("Indexing", journal.indices.joinToString(" · ").ifBlank { "—" })
        DetailLine("CAS category", journal.casMajor.ifBlank { "—" })
        DetailLine("Subjects", journal.subjects.joinToString(" · ").ifBlank { "—" })
        DetailLine("Review cycle", journal.reviewMonths?.let { "about ${"%.1f".format(it)} months" } ?: "Not available")
        if (showPublishFees) {
            DetailLine("Open access", if (journal.openAccess) "Yes" else "Not listed")
            DetailLine("APC", listOf(journal.apc, journal.apcFee).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Not available" })
            DetailLine("License", journal.license.ifBlank { "Not listed" })
        } else {
            Text("APC and publishing fee details are included with Pro.", color = BrandGreen, fontWeight = FontWeight.SemiBold)
        }
        if (journal.warning || journal.onHold || journal.underReview || journal.citicWarning) {
            Text("Check before submitting", color = Color(0xFF9B3B2F), fontWeight = FontWeight.Bold)
            Text("This record carries a warning or review flag. Verify the latest publisher and index status before submission.")
        }
    }
}

@Composable
private fun LoginSheet(
    state: UiState,
    onGoogleLogin: () -> Unit,
    onRequestCode: (String) -> Unit,
    onVerifyCode: (String) -> Unit,
    onOpenReviewerLogin: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf(state.emailLogin.email) }
    var code by rememberSaveable { mutableStateOf("") }
    Column(
        Modifier.fillMaxWidth().padding(20.dp).padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Sign in to AILatest Journal", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("Use the same account on the website and Android.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = onGoogleLogin, modifier = Modifier.fillMaxWidth()) {
            Text("Continue with Google")
        }
        Row(verticalAlignment = Alignment.CenterVertically) { Divider(Modifier.weight(1f)); Text("  or  ", color = MaterialTheme.colorScheme.onSurfaceVariant); Divider(Modifier.weight(1f)) }
        if (!state.emailLogin.codeRequested) {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
            )
            Button(onClick = { onRequestCode(email) }, modifier = Modifier.fillMaxWidth(), enabled = !state.emailLogin.isLoading) { Text("Email me a code") }
        } else {
            OutlinedTextField(
                value = code,
                onValueChange = { if (it.length <= 6) code = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Six-digit code") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
            )
            Button(onClick = { onVerifyCode(code) }, modifier = Modifier.fillMaxWidth(), enabled = !state.emailLogin.isLoading) { Text("Verify and sign in") }
        }
        OutlinedButton(onClick = onOpenReviewerLogin, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Lock, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Use review email")
        }
        state.emailLogin.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun ReviewerLoginPrompt(onOpen: () -> Unit) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Reviewer sign-in", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "For Google Play review only. Use the review email and password provided to Google Play.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Lock, contentDescription = null)
                Spacer(Modifier.size(8.dp))
                Text("Sign in with reviewer account")
            }
        }
    }
}

@Composable
private fun ReviewerLoginSheet(
    state: UiState,
    onReviewerLogin: (String, String) -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    Column(
        Modifier.fillMaxWidth().padding(20.dp).padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Reviewer sign-in", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "Use the dedicated account supplied in the Google Play review instructions.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Reviewer email") },
            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
        )
        Button(
            onClick = { onReviewerLogin(email.trim(), password) },
            modifier = Modifier.fillMaxWidth(),
            enabled = email.isNotBlank() && password.isNotBlank() && !state.emailLogin.isLoading,
        ) { Text("Sign in for review") }
        state.emailLogin.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun LoginPrompt(onLogin: () -> Unit, onGoogleLogin: () -> Unit, onReviewerLogin: () -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("One account, every device", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Sign in to sync your saved journals and subscription access.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onReviewerLogin, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Lock, contentDescription = null)
                Spacer(Modifier.size(8.dp))
                Text("Review login (email + password)")
            }
            Button(onClick = onGoogleLogin, modifier = Modifier.fillMaxWidth()) { Text("Continue with Google") }
            OutlinedButton(onClick = onLogin, modifier = Modifier.fillMaxWidth()) { Text("Use email code") }
        }
    }
}

@Composable
private fun SubscriptionCard(label: String, monthly: PlayOption?, yearly: PlayOption?, onBuy: (String, String) -> Unit) {
    ElevatedCard {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                if (label == "Max") TierBadge("max")
            }
            Text(if (label == "Pro") "Cloud favorites, advanced journal signals, and 500 AI credits/month." else "Everything in Pro plus exports, integrations, and 1,000 AI credits/month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                monthly?.let { PriceButton("${it.price} / month", it.tier, "monthly", onBuy, Modifier.weight(1f)) }
                yearly?.let { PriceButton("${it.price} / year", it.tier, "yearly", onBuy, Modifier.weight(1f), primary = true) }
            }
        }
    }
}

@Composable
private fun PriceButton(label: String, tier: String, plan: String, onBuy: (String, String) -> Unit, modifier: Modifier, primary: Boolean = false) {
    if (primary) Button(onClick = { onBuy(tier, plan) }, modifier = modifier, contentPadding = PaddingValues(horizontal = 8.dp)) { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    else OutlinedButton(onClick = { onBuy(tier, plan) }, modifier = modifier, contentPadding = PaddingValues(horizontal = 8.dp)) { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

@Composable
private fun AccessSummary(entitlements: Entitlements) {
    ElevatedCard {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Current access", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TierBadge(entitlements.productTier)
            }
            val access = buildList {
                if (entitlements.favoritesEnabled) add("cloud favorites")
                if (entitlements.publishFeeInfo) add("APC / publishing fee details")
                if (entitlements.aiEnabled) add("AI recommendations")
            }
            Text(if (access.isEmpty()) "Search and journal details are available on Free." else access.joinToString(" · ").replaceFirstChar { it.uppercase() })
            if (entitlements.aiEnabled && entitlements.aiCredits != null) Text("AI credits left: ${entitlements.aiCredits}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun UpgradeCard(title: String, body: String, action: String, onClick: () -> Unit) {
    ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onClick) { Text(action) }
        }
    }
}

@Composable
private fun EmptyState(title: String, body: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Default.Search, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(38.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (action != null && onAction != null) Button(onClick = onAction) { Text(action) }
    }
}

@Composable
private fun LetterMark(name: String) {
    Surface(shape = RoundedCornerShape(12.dp), color = BrandGreen.copy(alpha = 0.12f), modifier = Modifier.size(42.dp)) {
        Box(contentAlignment = Alignment.Center) { Text(name.firstOrNull()?.uppercase() ?: "J", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
    }
}

@Composable
private fun MetricPill(label: String, value: String, danger: Boolean = false) {
    Surface(shape = RoundedCornerShape(8.dp), color = if (danger) Color(0xFFFFE8E4) else MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = if (danger) Color(0xFF9B3B2F) else MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = if (danger) Color(0xFF9B3B2F) else MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun TierBadge(tier: String) {
    val normalized = tier.lowercase()
    val label = when (normalized) { "max" -> "MAX"; "pro" -> "PRO"; "trial" -> "TRIAL"; else -> "FREE" }
    AssistChip(
        onClick = {},
        label = { Text(label, fontWeight = FontWeight.Bold, fontSize = 10.sp) },
        leadingIcon = if (normalized == "max" || normalized == "pro") ({ Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp)) }) else null,
        colors = AssistChipDefaults.assistChipColors(
            containerColor = if (normalized == "max" || normalized == "pro") BrandGold.copy(alpha = 0.22f) else MaterialTheme.colorScheme.surfaceVariant,
        ),
    )
}

private fun Color.toArgbCompat(): Int =
    android.graphics.Color.argb((alpha * 255).toInt(), (red * 255).toInt(), (green * 255).toInt(), (blue * 255).toInt())
