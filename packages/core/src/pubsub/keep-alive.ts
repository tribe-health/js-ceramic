import { Observable, Subscription, interval } from 'rxjs'
import { MsgType, PubsubMessage } from './pubsub-message'
import { ObservableNext } from './observable-next'

export class KeepAlive extends Observable<PubsubMessage> implements ObservableNext<PubsubMessage> {
  private lastSent: number = Date.now()

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
      pubsub.subscribe(subscriber)
      const keepalive = interval(period).subscribe(() => {
        const now = Date.now()
        if (now - this.lastSent >= this.window) {
          this.next({ typ: MsgType.KEEPALIVE, ts: now })
        }
      })
      return () => {
        console.log('keep-alive.unsubscribe')
        keepalive.unsubscribe()
      }
    })
  }

  next(m: PubsubMessage): Subscription {
    console.log('keep-alive.next', new Date(), m)
    this.lastSent = Date.now()
    return this.pubsub.next(m)
  }
}
