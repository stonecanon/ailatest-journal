package org.ailatest.journal

import android.app.Activity
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

data class PlayOption(
    val tier: String,
    val basePlanId: String,
    val price: String,
    val details: ProductDetails,
    val offerToken: String,
)

/**
 * Small wrapper around Play Billing. It never decides membership locally:
 * every PURCHASED token is sent to the Worker, which verifies it with Google
 * Play Developer API and writes the shared website entitlement.
 */
class GooglePlayBilling(
    context: Context,
    private val onPurchase: suspend (Purchase) -> Boolean,
) : PurchasesUpdatedListener {
    var options by mutableStateOf<List<PlayOption>>(emptyList())
        private set
    var status by mutableStateOf("")
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val client = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build(),
        )
        .build()

    fun connectAndRestore() {
        if (client.isReady) {
            queryProducts()
            restorePurchases()
            return
        }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    status = ""
                    queryProducts()
                    restorePurchases()
                } else {
                    status = "Google Play is unavailable on this device."
                }
            }

            override fun onBillingServiceDisconnected() {
                status = "Google Play connection lost. Tap restore to retry."
            }
        })
    }

    fun restorePurchases() {
        if (!client.isReady) {
            connectAndRestore()
            return
        }
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
        ) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                purchases.forEach(::processPurchase)
            } else {
                status = "Could not restore Google Play purchases."
            }
        }
    }

    fun buy(activity: Activity, tier: String, basePlanId: String) {
        if (!client.isReady) {
            status = "Connecting to Google Play…"
            connectAndRestore()
            return
        }
        val option = options.firstOrNull { it.tier == tier && it.basePlanId == basePlanId }
        if (option == null) {
            status = "This plan is not available in Google Play yet."
            return
        }
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(option.details)
            .setOfferToken(option.offerToken)
            .build()
        val result = client.launchBillingFlow(
            activity,
            BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(productParams))
                .build(),
        )
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            status = result.debugMessage.ifBlank { "Could not start Google Play checkout." }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when {
            result.responseCode == BillingClient.BillingResponseCode.OK -> purchases.orEmpty().forEach(::processPurchase)
            result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> status = "Purchase canceled."
            else -> status = result.debugMessage.ifBlank { "Google Play purchase failed." }
        }
    }

    fun close() {
        client.endConnection()
        scope.cancel()
    }

    private fun queryProducts() {
        val products = listOf("ailatest_pro", "ailatest_max").map { productId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(products).build(),
        ) { result, detailsResult ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                status = "Could not load subscription prices."
                return@queryProductDetailsAsync
            }
            options = detailsResult.productDetailsList.flatMap { details ->
                val tier = when (details.productId) {
                    "ailatest_pro" -> "pro"
                    "ailatest_max" -> "max"
                    else -> ""
                }
                details.subscriptionOfferDetails.orEmpty().mapNotNull { offer ->
                    val basePlanId = offer.basePlanId
                    if (tier.isBlank() || basePlanId !in setOf("monthly", "yearly")) return@mapNotNull null
                    val price = offer.pricingPhases.pricingPhaseList.lastOrNull()?.formattedPrice
                        ?: return@mapNotNull null
                    PlayOption(tier, basePlanId, price, details, offer.offerToken)
                }
            }
        }
    }

    private fun processPurchase(purchase: Purchase) {
        when (purchase.purchaseState) {
            Purchase.PurchaseState.PENDING -> status = "Purchase is pending. Access unlocks after Google confirms payment."
            Purchase.PurchaseState.PURCHASED -> scope.launch {
                val verified = onPurchase(purchase)
                if (verified && !purchase.isAcknowledged) {
                    val ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.purchaseToken)
                        .build()
                    client.acknowledgePurchase(ackParams) { ackResult ->
                        if (ackResult.responseCode != BillingClient.BillingResponseCode.OK) {
                            status = "Purchase verified; acknowledgement will retry automatically."
                        }
                    }
                }
            }
        }
    }
}
