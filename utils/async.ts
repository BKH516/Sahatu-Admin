export async function runWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (limit <= 0) {
        throw new Error('Concurrency limit must be greater than 0');
    }

    if (!items.length) {
        return [];
    }

    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers: Promise<void>[] = [];

    const next = async () => {
        while (cursor < items.length) {
            const currentIndex = cursor++;
            results[currentIndex] = await task(items[currentIndex], currentIndex);
        }
    };

    const workerCount = Math.min(limit, items.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push(next());
    }

    await Promise.all(workers);
    return results;
}

export function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }
}

