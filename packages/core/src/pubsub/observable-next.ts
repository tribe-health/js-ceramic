import { Observable, Subscription } from 'rxjs';

export type ObservableNext<T> = Observable<T> & { next: (m: T) => Subscription }
