import { SubscriptionLike, Observable, Subscription, interval } from 'rxjs'
import { MsgType, PubsubMessage } from './pubsub-message'
import { ObservableNext } from './observable-next'

export class KeepAlive
  extends Observable<PubsubMessage>
  implements SubscriptionLike, ObservableNext<PubsubMessage>
{
  private subscription: Subscription | undefined = undefined
  private lastSent: number = Date.now()
  private keepalive: Subscription

  /**
   * @param pubsub
   * @param period - how often to check the last message timestamp
   * @param window - max allowed message between messages [worst case for between-message time is period+window]
   */
  constructor(
    private readonly pubsub: ObservableNext<PubsubMessage>,
    private readonly period: number,
    private readonly window: number
  ) {
    super((subscriber) => {
      console.log('keep-alive.subscribed', new Date())
      this.subscription = pubsub.subscribe(subscriber)
    })
    this.keepalive = interval(period).subscribe(() => {
      const now = Date.now()
      if (now - this.lastSent >= this.window) {
        this.next({ typ: MsgType.KEEPALIVE, ts: now })
      }
    })
  }

  get closed(): boolean {
    let result = false
    if (this.subscription) {
      result = this.subscription.closed
    } else {
      result = false
    }
    console.log(`keep-alive.closed`, new Date(), result)
    return result
  }

  unsubscribe(): void {
    console.log('keep-alive.unsubscribe', new Date(), Boolean(this.subscription))
    this.keepalive.unsubscribe()
    this.subscription?.unsubscribe()
  }

  next(m: PubsubMessage): Subscription {
    console.log('keep-alive.next', new Date(), m)
    this.lastSent = Date.now()
    return this.pubsub.next(m)
  }
}
