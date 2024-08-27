function* map<T, S>(iterator: IterableIterator<T>, mapFn: (item: T) => S
  ): IterableIterator<S> {
    for (const item of iterator) {
      yield mapFn(item);
    }
  }

export { map };