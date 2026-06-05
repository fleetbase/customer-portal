import { get } from '@ember/object';

export function valueFor(subject, path, defaultValue = null) {
    if (!subject || !path) {
        return defaultValue;
    }

    const value = get(subject, path);

    return value === undefined ? defaultValue : value;
}

export function arrayFor(subject) {
    if (!subject) {
        return [];
    }

    if (typeof subject.toArray === 'function') {
        return subject.toArray();
    }

    return Array.isArray(subject) ? subject : [];
}

export function identifierFor(subject) {
    return valueFor(subject, 'uuid') ?? valueFor(subject, 'public_id') ?? valueFor(subject, 'id') ?? subject;
}
