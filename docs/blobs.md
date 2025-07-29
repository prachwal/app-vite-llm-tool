---
title: "Netlify Blobs"
description: "Store and retrieve unstructured data. Use blob storage as a simple key/value store or basic database."
---

With Netlify Blobs, you can store and retrieve [blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and unstructured data. You can also use this feature as a simple key/value store or basic database.

Netlify Blobs is a highly-available data store optimized for frequent reads and infrequent writes.

For maximum flexibility, it offers a [configurable consistency model](/build/data-and-storage/netlify-blobs/#consistency). If multiple write calls to the same key are issued, the last write wins.

We automatically handle provisioning, configuration, and access control for you. This integrated zero-configuration solution helps you focus on building business value in your project rather than toil on setting up and scaling a separate blob storage solution.

## How CRUD operations work

Each blob belongs to a single site. A site can have multiple namespaces for blobs. We call these _stores_. This allows you to, for example, have the key `my-key` exist as an object in a store for `file-uploads` and separately as an object in a store for `json-uploads` with different data. Every blob must be associated with a store, even if a site is not using multiple namespaces. 

You can perform CRUD operations for Netlify Blobs from the following Netlify features:

- [Functions](/build/functions/overview)
- [Edge Functions](/build/edge-functions/overview)
- [Build Plugins](/extend/install-and-use/build-plugins) - note that though a plugin can read from any stores on the site, a plugin can write to only [deploy-specific stores](#deploy-specific-stores) 
- [Netlify CLI](/api-and-cli-guides/cli-guides/get-started-with-cli) - visit the [CLI command reference](https://cli.netlify.com/commands/blobs/) for details 

You can also: 
- write to deploy-specific stores using [file-based uploads](#file-based-uploads)
- browse and download blobs in the [Netlify Blobs UI](#netlify-blobs-ui)

## Use cases

Netlify Blobs is a platform primitive that developers and frameworks can use as a building block for many different purposes. Here are a few [examples of powerful patterns](https://www.netlify.com/blog/introducing-netlify-blobs-beta/) that you can use:

- **Data store for functions.** With [Background Functions](/build/functions/background-functions), you can trigger asynchronous serverless workflows for long-running operations like generating a site map, processing media assets, or sending emails in bulk. You can then use Netlify Blobs to persist the output of those computations.
- **Processing user uploads.** If your application takes user submissions, like reviews on a product page or image files for a gallery, Netlify Blobs can store that data. When paired with Functions or Edge Functions, you can create an endpoint to receive an upload, validate the contents, and persist the validated data.

For more advanced use cases - such as those that require complex queries, concurrency control, or a relational data model - explore our [integrations with the best-in-class database vendors](https://www.netlify.com/integrations/database-and-backend/).

## API reference

To use the Netlify Blobs API, first install the `@netlify/blobs` module using the [package manager of your choice](/build/configure-builds/manage-dependencies#javascript-dependencies):

```bash
npm install @netlify/blobs
```

Then use the below methods in your functions, edge functions, or build plugins. 

### `getStore`

Opens a site-wide store for reading and writing blobs. Data added to that store will be persisted on new deploys, available on all [deploy contexts](/deploy/deploy-overview#branches-and-deploys) and accessible from from [Functions](/build/functions/overview), [Edge Functions](/build/edge-functions/overview) and [Build Plugins](/extend/install-and-use/build-plugins).

```js
const store = getStore(name, { siteID, token })
```

> **Note - SiteID same as Project ID:** Your `SiteID` appears as the Project ID in the Netlify app UI at `app.netlify.com`. To find this ID in the Netlify UI, go to 
### NavigationPath Component:

Project configuration > General > Project information
, and copy the value for **Project ID**.

#### Parameters

- **`name`:** the name of the store; this can be any string that adheres to the [store naming requirements](/build/data-and-storage/netlify-blobs/#requirements-and-limitations)
- **`siteID`** (optional)**:** the ID of the Netlify site associated with the store; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins. You can also set the `siteID` to the ID of another site you own to access its blobs via the `getStore` method.

> **Note - SiteID same as Project ID:** Your `SiteID` appears as the Project ID in the Netlify app UI at `app.netlify.com`. To find this ID in the Netlify UI, go to 
### NavigationPath Component:

Project configuration > General > Project information
, and copy the value for **Project ID**.

- **`token`** (optional)**:** a [Netlify Personal Access Token](/api-and-cli-guides/cli-guides/get-started-with-cli#obtain-a-token-in-the-netlify-ui) that grants access to Blobs on the given site; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins

### Tip - Find your Netlify site ID

To find your Netlify site ID (also called Project ID in the Netlify UI), go to 
### NavigationPath Component:

Project configuration > General > Project information
, and copy the value for **Project ID**

#### Return value

An instance of a store on which you can [get](#get), [set](#set) or [delete](#delete) blobs.

### `getDeployStore`

Opens a [deploy-specific store](#deploy-specific-stores) for reading and writing blobs. Data added to that store will be scoped to a specific deploy, available on all [deploy contexts](/deploy/deploy-overview#branches-and-deploys) and accessible from from [Functions](/build/functions/overview), [Edge Functions](/build/edge-functions/overview) and [Build Plugins](/extend/install-and-use/build-plugins).

```js
const store = getDeployStore(name, { deployID, region, siteID, token })
```

> **Note - SiteID same as Project ID:** Your `SiteID` appears as the Project ID in the Netlify app UI at `app.netlify.com`. To find this ID in the Netlify UI, go to 
### NavigationPath Component:

Project configuration > General > Project information
, and copy the value for **Project ID**.

#### Parameters

- **`name`:** the name of the store; this can be any string that adheres to the [store naming requirements](/build/data-and-storage/netlify-blobs/#requirements-and-limitations)
- **`deployID`** (optional)**:** the ID of the Netlify deploy associated with the store; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins
- **`region`** (optional)**:** the [region](#regions) associated with the store; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins
- **`siteID`** (optional)**:** the ID of the Netlify site associated with the store; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins.

> **Note - SiteID same as Project ID:** Your `SiteID` appears as the Project ID in the Netlify app UI at `app.netlify.com`. To find this ID in the Netlify UI, go to 
### NavigationPath Component:

Project configuration > General > Project information
, and copy the value for **Project ID**.

- **`token`** (optional)**:** a [Netlify Personal Access Token](/api-and-cli-guides/cli-guides/get-started-with-cli#obtain-a-token-in-the-netlify-ui) that grants access to Blobs on the given site; this is set automatically when you use Blobs from Functions, Edge Functions or Build Plugins

#### Return value

An instance of a store on which you can [get](#get), [set](#set) or [delete](#delete) blobs.

### `set`

Creates an object with the given key and value. If an entry with the given key already exists, its value is overwritten.

```js
await store.set(key, value, { metadata, onlyIfMatch, onlyIfNew })
```

#### Parameters

- **`key`:** a string representing the object key
- **`value`:** the value as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), or string
- **`metadata`** (optional)**:** a JSON object with arbitrary metadata to attach to the object
- **`onlyIfMatch`** (optional)**:** when set, the write will only succeed if the entry exists and has an [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) matching this value
- **`onlyIfNew`** (optional)**:** when set, the write will only succeed if the entry does not exist

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`modified`** (boolean): Whether the operation has actually generated a new entry
- **`etag`** (string): The [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of the entry, if the operation has generated a new entry; if not, this property will be omitted

#### Example

This example shows how you might use Netlify Blobs to persist user-generated uploads. For a more in-depth explanation, refer to [this guide](https://developers.netlify.com/guides/user-generated-uploads-with-netlify-blobs/).

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Accessing the request as `multipart/form-data`.
  const form = await req.formData();
  const file = form.get("file") as File;

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("file-uploads");
  await uploads.set(key, file, {
    metadata: { country: context.geo.country.name }
  });

  return new Response("Submission saved");
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Accessing the request as `multipart/form-data`.
  const form = await req.formData();
  const file = form.get("file") as File;

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("file-uploads");
  await uploads.set(key, file, {
    metadata: { country: context.geo.country.name }
  });

  return new Response("Submission saved");
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  // Reading a file from disk at build time.
  const file = await readFile("some-file.txt", "utf8");

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("file-uploads");
  await uploads.set(key, file, {
    metadata: { country: "Spain" }
  });
};
```
</TabItem>

The example below shows how you can use the `onlyIfMatch` and `onlyIfNew` properties to do atomic, conditional writes.

### Tabs Component:

<TabItem label="only if key is new">
``` ts

export default async (req: Request, context: Context) => {
  const emails = getStore("emails");
  
  const { modified } = await emails.set(
    "jane@netlify.com",
    "Jane Doe",
    { onlyIfNew: true }
  );

  if (modified) {
    return new Response("Submission saved");
  }

  return new Response("Email already exists", { status: 400 });
};
```
</TabItem>

<TabItem label="only if key exists with given ETag">
``` ts

export default async (req: Request, context: Context) => {
  const emails = getStore("emails");
  
  // `myLocalCache` is a stub for a local cache implementation you
  // might implement.
  const { data, etag } = myLocalCache.get("jane@netlify.com")

  const updatedData = {
    ...data,
    lastSeen: Date.now()
  }

  // Update Jane's information only if it hasn't changed since we
  // cached it.
  const { modified } = await emails.set(
    "jane@netlify.com",
    "New Jane",
    { onlyIfMatch: etag }
  );

  if (!modified) {
    return new Response(
      "Cached data is stale. Someone else must've updated the data!",
      { status: 400 }
    );
  }
  
  return new Response("Submission saved");
};
```
</TabItem>

### `setJSON`

Convenience method for creating a JSON-serialized object. If an entry with the given key already exists, its value is overwritten.

```js
setJSON(key, value, { metadata, onlyIfMatch, onlyIfNew })
```

#### Parameters

- **`key`:** a string representing the object key
- **`value`:** any value that is [serializable to JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- **`metadata`** (optional)**:** a JSON object with arbitrary metadata to attach to the object
- **`onlyIfMatch`** (optional)**:** when set, the write will only succeed if the entry exists and has an [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) matching this value
- **`onlyIfNew`** (optional)**:** when set, the write will only succeed if the entry does not exist

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`modified`** (boolean): Whether the operation has actually generated a new entry
- **`etag`** (string): The [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of the entry, if the operation has generated a new entry; if not, this property will be omitted

#### Example

This example shows how you might use Netlify Blobs to persist user-generated data.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Expecting the request body to contain JSON.
  const data = await req.json();

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("json-uploads");
  await uploads.setJSON(key, data, {
    metadata: { country: context.geo.country.name }
  });

  return new Response("Submission saved");
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Expecting the request body to contain JSON.
  const data = await req.json();

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("json-uploads");
  await uploads.setJSON(key, data, {
    metadata: { country: context.geo.country.name }
  });

  return new Response("Submission saved");
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  // Reading a file from disk at build time.
  const file = await readFile("some-file.txt", "utf8");

  // Expecting the file to contain JSON.
  const data = JSON.parse(file);

  // Generating a unique key for the entry.
  const key = uuid();
  
  const uploads = getStore("json-uploads");
  await uploads.setJSON(key, data, {
    metadata: { country: "Spain" }
  });
};
```
</TabItem>

### `get`

Retrieves an object with the given key.

```js
await store.get(key, { consistency, type })
```

#### Parameters

- **`key`:** a string representing the object key
- **`consistency`** (optional)**:** a string representing the [consistency model](#consistency) for the operation
- **`type`** (optional)**:** the format in which the object should be returned - the default format is a string but you can specify one of the following values instead:
  - **`arrayBuffer`:** returns the entry as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
  - **`blob`:** returns the entry as a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
  - **`json`:** parses the entry as JSON and returns the resulting object
  - **`stream`:** returns the entry as a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
  - **`text`:** default, returns the entry as a string of plain text

#### Return value

A `Promise` that resolves with the blob in the format specified by `type`: `ArrayBuffer`, `Blob`, `Object`, `ReadableStream` or a string.

If an object with the given key is not found, a `Promise` that resolves with `null` is returned.

#### Example

This example shows how you might read user-generated data that has been previously uploaded to Netlify Blobs.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const entry = await uploads.get(key);

  if (entry === null) {
    return new Response(`Could not find entry with key ${key}`, {
      status: 404
    });
  }

  return new Response(entry);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const entry = await uploads.get(key);

  if (entry === null) {
    return new Response(`Could not find entry with key ${key}`, {
      status: 404
    });
  }

  return new Response(entry);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore("file-uploads");
  const entry = await uploads.get("my-key");

  if (entry === null) {
    console.log("Could not find entry");
  } else {
    console.log(entry);
  }
};
```
</TabItem>

### `getWithMetadata`

Retrieves an object along with its metadata.

This method is useful to check if a blob exists without actually retrieving it and having to download a potentially large blob over the network.

```js
await store.getWithMetadata(key, { consistency, etag, type })
```

#### Parameters

- **`key`:** a string representing the object key
- **`consistency`** (optional)**:** a string representing the [consistency model](#consistency) for the operation
- **`etag`** (optional)**:** an opaque quoted string, possibly prefixed by a weakness indicator, representing the [`ETag` value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of any version of this blob you may have cached  - this allows you to do [conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests)
- **`type`** (optional)**:** the format in which the object should be returned - the default format is a string but you can specify one of the following values instead:
  - **`arrayBuffer`:** returns the entry as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
  - **`blob`:** returns the entry as a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
  - **`json`:** parses the entry as JSON and returns the resulting object
  - **`stream`:** returns the entry as a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
  - **`text`:** default, returns the entry as a string of plain text

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`data`:** the blob contents in the format specified by the `type` parameter, or `null` if the `etag` property is the same as the `etag` parameter (meaning the cached object is still fresh)
- **`etag`:** an opaque quoted string, possibly prefixed by a weakness indicator, representing the [`ETag` value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of the object
- **`metadata`:** object with arbitrary metadata

If an object with the given key is not found, a `Promise` that resolves with `null` is returned.

#### Example

This example shows how you might read metadata from user-generated submissions that have been previously uploaded to Netlify Blobs.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const { data, metadata } = await uploads.getWithMetadata(key);

  if (entry === null) {
    return new Response(`Could not find entry with key ${key}`, {
      status: 404
    });
  }

  return new Response(entry, { headers: { "X-Country": metadata.country } });
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const { data, metadata } = await uploads.getWithMetadata(key);

  if (entry === null) {
    return new Response(`Could not find entry with key ${key}`, {
      status: 404
    });
  }

  return new Response(entry, { headers: { "X-Country": metadata.country } });
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore("file-uploads");
  const { data, metadata } = await uploads.getWithMetadata("my-key");

  if (entry === null) {
    console.log("Could not find entry");
  } else {
    console.log("Data:", data);
    console.log("Country:", metadata.country);
  }
};
```
</TabItem>

### Collapsible Component:

**Conditional request examples**

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Mock implementation of a system for locally persisting blobs and their etags
  const cachedETag = getFromMockCache("my-key");

  const uploads = getStore("file-uploads");

  // Get entry from the blob store only if its ETag is different from the one you
  // have locally, which means the entry has changed since you last retrieved it.
  // Compare the whole value including surrounding quotes and any weakness prefix.
  const { data, etag } = await uploads.getWithMetadata("my-key", {
    etag: cachedETag,
  });

  if (etag === cachedETag) {
    // `data` is `null` because the local blob is fresh
    return new Response("Still fresh");
  }

  // `data` contains the new blob, store it locally alongside the new ETag
  writeInMockCache("my-key", data, etag);

  return new Response("Updated");
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Mock implementation of a system for locally persisting blobs and their etags
  const cachedETag = getFromMockCache("my-key");

  const uploads = getStore("file-uploads");

  // Get entry from the blob store only if its ETag is different from the one you
  // have locally, which means the entry has changed since you last retrieved it.
  // Compare the whole value including surrounding quotes and any weakness prefix.
  const { data, etag } = await uploads.getWithMetadata("my-key", {
    etag: cachedETag,
  });

  if (etag === cachedETag) {
    // `data` is `null` because the local blob is fresh
    return new Response("Still fresh");
  }

  // `data` contains the new blob, store it locally alongside the new ETag
  writeInMockCache("my-key", data, etag);
	
  return new Response("Updated");
};
```
</TabItem>

</Tabs>

---

You can use object metadata to create client-side expiration logic. To delete blobs you consider expired, do the following:

1. [`set` your objects with metadata](#set) that you can base the expiration logic on, such as a timestamp
2. `getWithMetadata` to check if an object is expired
3. [`delete`](#delete) the expired object

### Collapsible Component:

**Expiration logic examples**

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const uploads = getStore("file-uploads");
  const key = "my-key";

  // Set the entry with an `expiration` metadata property
  await uploads.set(key, await req.text(), {
    metadata: {
      expiration: new Date("2024-01-01").getTime()
    }
  });

  // Read the entry and compare the `expiration` metadata
  // property against the current timestamp
  const entry = await uploads.getWithMetadata(key);

  if (entry === null) {
    return new Response("Blob does not exist");
  }

  const { expiration } = entry.metadata;

  // If the expiration date is in the future, it means
  // the blob is still fresh, so return it
  if (expiration && expiration < Date.now()) {
    return new Response(entry.data);
  }

  // Delete the expired entry
  await uploads.delete(key);

  return new Response("Blob has expired");
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const uploads = getStore("file-uploads");
  const key = "my-key";

  // Set the entry with an `expiration` metadata property
  await uploads.set(key, await req.text(), {
    metadata: {
      expiration: new Date("2024-01-01").getTime()
    }
  });

  // Read the entry and compare the `expiration` metadata
  // property against the current timestamp
  const entry = await uploads.getWithMetadata(key);

  if (entry === null) {
    return new Response("Blob does not exist");
  }

  const { expiration } = entry.metadata;

  // If the expiration date is in the future, it means
  // the blob is still fresh, so return it
  if (expiration && expiration < Date.now()) {
    return new Response(entry.data);
  }

  // Delete the expired entry
  await uploads.delete(key);

  return new Response("Blob has expired");
};
```
</TabItem>

</Tabs>

---

### `getMetadata`

Retrieves the metadata for an object, if the object exists.

This method is useful to check if a blob exists without actually retrieving it and having to download a potentially large blob over the network.

```js
await store.getMetadata(key, { consistency, etag, type })
```

#### Parameters

- **`key`:** a string representing the object key
- **`consistency`** (optional)**:** a string representing the [consistency model](#consistency) for the operation
- **`etag`** (optional)**:** an opaque quoted string, possibly prefixed by a weakness indicator, representing the [`ETag` value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of any version of this blob you may have cached  - this allows you to do [conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests)
- **`type`** (optional)**:** the format in which the object should be returned - the default format is a string but you can specify one of the following values instead:
  - **`arrayBuffer`:** returns the entry as an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
  - **`blob`:** returns the entry as a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
  - **`json`:** parses the entry as JSON and returns the resulting object
  - **`stream`:** returns the entry as a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
  - **`text`:** default, returns the entry as a string of plain text

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`metadata`:** object with arbitrary metadata
- **`etag`:** an opaque quoted string, possibly prefixed by a weakness indicator, representing the [`ETag` value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) of the object

If an object with the given key is not found, a `Promise` that resolves with `null` is returned.

#### Example

This example shows how you might read metadata from user-generated submissions that have been previously uploaded to Netlify Blobs.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Extracting key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const entry = await uploads.getMetadata(key);

  if (entry === null) {
    return new Response("Blob does not exist");
  }

  return Response.json({
    etag: entry.etag,
    metadata: entry.metadata
  });
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Extracting key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  const entry = await uploads.getMetadata(key);

  if (entry === null) {
    return new Response("Blob does not exist");
  }

  return Response.json({
    etag: entry.etag,
    metadata: entry.metadata
  });
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore("file-uploads");
  const entry = await uploads.getMetadata("my-key");

  console.log(entry.etag, entry.metadata);
};
```
</TabItem>

### `list`

Returns a list of blobs in a given store.

```js
await store.list({ directories, paginate, prefix })
```

#### Parameters

- **`directories`** (optional)**:** a boolean that indicates whether keys with the `/` character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them
- **`paginate`** (optional)**:** a boolean that specifies whether you want to [handle pagination manually](#manual-pagination) - by default, it is handled automatically
- **`prefix`** (optional)**:** a string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`blobs`:** an array of blobs that match the query parameters, shown as objects with `etag` and `key` properties, which represent an object's [`ETag` value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) and key, respectively
- **`directories`:** an array of strings representing any directories matching the query parameters

#### Example

This example shows how you might list all blobs in a given store, logging the key and etag of each entry.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const uploads = getStore("file-uploads");
  const { blobs } = await uploads.list();
  
  // [ { etag: "\"etag1\"", key: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }, { etag: "\"etag2\"", key: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" } ]
  console.log(blobs);

  return new Response(`Found ${blobs.length} blobs`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const uploads = getStore("file-uploads");
  const { blobs } = await uploads.list();
  
  // [ { etag: "\"etag1\"", key: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }, { etag: "\"etag2\"", key: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" } ]
  console.log(blobs);

  return new Response(`Found ${blobs.length} blobs`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore("file-uploads");
  const { blobs } = await uploads.list();

  // [ { etag: "\"etag1\"", key: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }, { etag: "\"etag2\"", key: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" } ]
  console.log(blobs);
};
```
</TabItem>

#### Hierarchy

Optionally, you can group blobs together under a common prefix and then browse them hierarchically when listing a store. This is similar to grouping files in a directory. To browse hierarchically, do the following:

1. Group keys hierarchically with the `/` character in your key names.
2. List entries hierarchically with the `directories` parameter.
3. Drill down into a specific directory with the `prefix` parameter.

### Collapsible Component:

**Hierarchical browsing examples**

Take the following set of keys as an example:

```
cats/shorthair.jpg
cats/longhair.jpg
dogs/beagle.jpg
dogs/corgi.jpg
bird.jpg
```

#### Pagination

By default, `list` will return all five keys.

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs } = await animals.list();
  
  // [
  //   { etag: "\"etag1\"", key: "cats/shorthair.jpg" },
  //   { etag: "\"etag2\"", key: "cats/longhair.jpg" },
  //   { etag: "\"etag3\"", key: "dogs/beagle.jpg" },
  //   { etag: "\"etag4\"", key: "dogs/corgi.jpg" },
  //   { etag: "\"etag5\"", key: "bird.jpg" },
  // ]
  console.log(blobs);

  return new Response(`Found ${blobs.length} blobs`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs } = await animals.list();
  
  // [
  //   { etag: "\"etag1\"", key: "cats/shorthair.jpg" },
  //   { etag: "\"etag2\"", key: "cats/longhair.jpg" },
  //   { etag: "\"etag3\"", key: "dogs/beagle.jpg" },
  //   { etag: "\"etag4\"", key: "dogs/corgi.jpg" },
  //   { etag: "\"etag5\"", key: "bird.jpg" },
  // ]
  console.log(blobs);

  return new Response(`Found ${blobs.length} blobs`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const animals = getDeployStore("animals");
  const { blobs } = await animals.list();

  // [
  //   { etag: "\"etag1\"", key: "cats/shorthair.jpg" },
  //   { etag: "\"etag2\"", key: "cats/longhair.jpg" },
  //   { etag: "\"etag3\"", key: "dogs/beagle.jpg" },
  //   { etag: "\"etag4\"", key: "dogs/corgi.jpg" },
  //   { etag: "\"etag5\"", key: "bird.jpg" },
  // ]
  console.log(blobs);
};
```
</TabItem>

</Tabs>

To list entries hierarchically, set the `directories` parameter to `true`.

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs, directories } = await animals.list({ directories: true });

  // [ { etag: "\"etag5\"", key: "bird.jpg" } ]
  console.log(blobs);

  // [ "cats", "dogs" ]
  console.log(directories);

  return new Response(`Found ${blobs.length} blobs and ${directories.length} directories`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs, directories } = await animals.list({ directories: true });

  // [ { etag: "\"etag5\"", key: "bird.jpg" } ]
  console.log(blobs);

  // [ "cats", "dogs" ]
  console.log(directories);

  return new Response(`Found ${blobs.length} blobs and ${directories.length} directories`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const animals = getDeployStore("animals");
  const { blobs, directories } = await animals.list({ directories: true });

  // [ { etag: "\"etag5\"", key: "bird.jpg" } ]
  console.log(blobs);

  // [ "cats", "dogs" ]
  console.log(directories);
};
```
</TabItem>

</Tabs>

To drill down into a directory and get a list of its items, set the `prefix` parameter to the directory name.

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs, directories } = await animals.list({
    directories: true,
    prefix: "cats/",
  });

  // [ { etag: "\"etag1\"", key: "cats/shorthair.jpg" }, { etag: "\"etag2\"", key: "cats/longhair.jpg" } ]
  console.log(blobs);

  // [ ]
  console.log(directories);

  return new Response(`Found ${blobs.length} blobs and ${directories.length} directories`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const animals = getStore("animals");
  const { blobs, directories } = await animals.list({
    directories: true,
    prefix: "cats/",
  });

  // [ { etag: "\"etag1\"", key: "cats/shorthair.jpg" }, { etag: "\"etag2\"", key: "cats/longhair.jpg" } ]
  console.log(blobs);

  // [ ]
  console.log(directories);

  return new Response(`Found ${blobs.length} blobs and ${directories.length} directories`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const animals = getDeployStore("animals");
  const { blobs, directories } = await animals.list({
    directories: true,
    prefix: "cats/",
  });

  // [ { etag: "\"etag1\"", key: "cats/shorthair.jpg" }, { etag: "\"etag2\"", key: "cats/longhair.jpg" } ]
  console.log(blobs);

  // [ ]
  console.log(directories);
};
```
</TabItem>

</Tabs>

Note that the prefix includes a trailing slash. This ensures that only entries under the `cats` directory are returned. Without a trailing slash, other keys like `catsuit` would also be returned.

---

For performance reasons, the server groups results into pages of up to 1,000 entries. By default, the `list` method automatically retrieves all pages, meaning you'll always get the full list of results.

 To handle pagination manually, set the `paginate` parameter to `true`. This makes `list` return an [`AsyncIterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator), which lets you take full control over the pagination process. This means you can fetch only the data you need when you need it.

### Collapsible Component:

**Manual blob pagination examples**

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const store = getStore("animals");

  let blobCount = 0;

  for await (const entry of store.list({ paginate: true })) {
    blobCount += entry.blobs.length;

    console.log(entry.blobs);
  }

  return new Response(`Found ${blobCount} blobs`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const store = getStore("animals");

  let blobCount = 0;

  for await (const entry of store.list({ paginate: true })) {
    blobCount += entry.blobs.length;

    console.log(entry.blobs);
  }

  return new Response(`Found ${blobCount} blobs`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const store = getDeployStore("animals");

  let blobCount = 0;

  for await (const entry of store.list({ paginate: true })) {
    blobCount += entry.blobs.length;

    console.log(entry.blobs);
  }

  console.log(`Found ${blobCount} blobs`);
};
```
</TabItem>

</Tabs>

---

### `listStores`

Returns a list of stores for a site. Does not include [deploy-specific stores](/build/data-and-storage/netlify-blobs/#deploy-specific-stores).

```js
await listStores({ paginate })
```

#### Parameters

- **`paginate`** (optional)**:** a boolean that specifies whether you want to [handle pagination manually](#manual-store-pagination) - by default, it is handled automatically

#### Return value

A `Promise` that resolves with an object containing the following properties:

- **`stores`:** an array of strings representing any stores matching the query parameters

#### Example

This example shows how you might list all stores for a given site.

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const { stores } = await listStores();
  
  // [ "file-uploads", "json-uploads" ]
  console.log(stores);

  return new Response(`Found ${stores.length} stores`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  const { stores } = await listStores();
  
  // [ "file-uploads", "json-uploads" ]
  console.log(stores);

  return new Response(`Found ${stores.length} stores`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const { stores } = await listStores();

  // [ "file-uploads", "json-uploads" ]
  console.log(stores);
};
```
</TabItem>

#### Pagination

For performance reasons, the server groups results into pages of up to 1,000 stores. By default, the `listStores` method automatically retrieves all pages, meaning you'll always get the full list of results.

 To handle pagination manually, set the `paginate` parameter to `true`. This makes `listStores` return an [`AsyncIterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator), which lets you take full control over the pagination process. This means you can fetch only the data you need when you need it.

### Collapsible Component:

**Manual store pagination examples**

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  let storeCount = 0;

  for await (const entry of listStores({ paginate: true })) {
    storeCount += entry.stores.length;

    console.log(entry.stores);
  }

  return new Response(`Found ${storeCount} stores`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  let storeCount = 0;

  for await (const entry of listStores({ paginate: true })) {
    storeCount += entry.stores.length;

    console.log(entry.stores);
  }

  return new Response(`Found ${storeCount} stores`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const { stores } = await listStores({
    paginate: true,
  });

  let storeCount = 0;

  for await (const entry of stores) {
    storeCount += entry.stores.length;

    console.log(entry.stores);
  }

  console.log(`Found ${storeCount} stores`);
};
```
</TabItem>

</Tabs>

---

### `delete`

Deletes an object with the given key, if one exists.

```js
await store.delete(key)
```

#### Parameters

- **`key`:** a string representing the object key

#### Return value

A `Promise` that resolves with `undefined`.

#### Example

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  await uploads.delete(key);

  return new Response("Blob has been deleted");
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Extract key from URL.
  const { key } = context.params;

  const uploads = getStore("file-uploads");
  await uploads.delete(key);

  return new Response("Blob has been deleted");
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore("file-uploads");
  await uploads.delete("my-key");

  console.log("Blob has been deleted");
};
```
</TabItem>

## File-based uploads

With file-based uploads, you can write blobs to [deploy-specific stores](#deploy-specific-stores) after the build completes and before the deploy starts. This can be useful for authors of frameworks and other tools integrating with Netlify as it does not require a build plugin. 

To make file-based uploads, place blob files in `.netlify/blobs/deploy` in your site's [base directory](/build/configure-builds/overview#definitions). Netlify uploads these files to blob storage maintaining their directory structure. Here is an example file tree:

```
.netlify/
├─ blobs/
|  ├─ deploy/
│  |  ├─ dogs/
│  │  |  └─ good-boy.jpg
│  |  ├─ cat.jpg
│  |  └─ mouse.jpg
```

This uploads the following blobs:
- `dogs/good-boy.jpg`
- `cat.jpg`
- `mouse.jpg`

To attach metadata to a blob, include a JSON file that prefixes the corresponding blob filename with `$` and has a `.json` extension. For example:

```
.netlify/
├─ blobs/
|  ├─ deploy/
│  |  ├─ dogs/
│  │  |  ├─ good-boy.jpg
│  │  |  └─ $good-boy.jpg.json
│  |  ├─ cat.jpg
│  |  ├─ mouse.jpg
│  |  └─ $mouse.jpg.json
```

This uploads the following blobs:
- `dogs/good-boy.jpg` with the metadata from `dogs/$good-boy.jpg.json`
- `cat.jpg` without metadata
- `mouse.jpg` with the metadata from `$mouse.jpg.json`

Metadata files must contain valid JSON or the deploy will fail. Here's an example of valid JSON metadata:

```json
{
  "name": "Jerry"
}
```

## Consistency

By default, the Netlify Blobs API uses an [eventual consistency](https://en.wikipedia.org/wiki/Eventual_consistency) model, where data is stored in a single region and cached at the edge for fast access across the globe. When a blob is added, it becomes globally available immediately. Updates and deletions are guaranteed to be propagated to all edge locations within 60 seconds.

You can configure this behavior and opt-in to strong consistency with the [Netlify Blobs API](#netlify-blobs-api), either for an entire store or for individual read operations. [Netlify CLI](https://cli.netlify.com/commands/blobs/) always uses strong consistency.

Choosing the right consistency model depends on your use case and each option comes with tradeoffs:

- if it's important for your application that updates and deletions become immediately available to all readers, you should consider using `strong` consistency, which comes with the cost of slower reads
- if that is not a hard requirement and you're optimizing for fast reads, you should consider using `eventual` consistency

### Tabs Component:

<TabItem label="store level">
``` ts

export default async (req: Request, context: Context) => {
  const store = getStore({ name: "animals", consistency: "strong" });

  await store.set("dog", "🐶");

  // This is a strongly-consistent read.
  const dog = await store.get("dog");

  return new Response(dog);
};
```
</TabItem>

<TabItem label="operation level">
``` ts

export default async (req: Request, context: Context) => {
  const store = getStore("animals");

  await store.set("dog", "🐶");

  // This is an eventually-consistent read.
  const dog1 = await store.get("dog");

  // This is a strongly-consistent read.
  const dog2 = await store.get("dog", { consistency: "strong" });

  return new Response(dog1 + dog2);
};
```
</TabItem>

## Netlify Blobs UI

In addition to using the Netlify Blobs API to [list](#list) and [get](#get) blobs, you can use the Netlify UI to browse and download blobs.

To explore and retrieve your site's blobs:

1. In the Netlify UI, go to the 
### NavigationPath Component:

Blobs
 page for your project.
2. If your site has more than one store, select the store of interest.

   ![](/images/blobs-select-store.png)

3. Then, drill into directories to explore the blobs in the store or **Download** an individual blob to examine it.  

## Sensitive data

You can store sensitive data with Netlify Blobs. To keep your data secure, we encrypt your blobs at rest and in transit.

Your blobs can only be accessed through your own site. You are responsible for making sure the code you use to access your blobs doesn't allow data to leak. We recommend that you consider the following best practices:
- Do not allow incoming requests for arbitrary keys if you have sensitive data. Treat user input as unsafe and scope your keys with something that callers cannot tamper with.
- Review the code of any [build plugin you install from the npm public registry](/extend/install-and-use/build-plugins#file-based-installation) to make sure it doesn't have malicious blob interactions.  

Visit our [security checklist](/resources/checklists/security-checklist#recommended-security-measures) for general security measures we recommend you consider for your site. 

## Deploy-specific stores

The namespaces you make with `getStore` are shared across all deploys of your site. This is required when using Netlify CLI and desirable for most use cases with functions and edge functions because it means that a new production deploy can read previously written data without you having to replicate blobs for each new production deploy. This also means you can test your Deploy Previews with production data. This does, however, mean that you should be careful to avoid scenarios such as a branch deploy deleting blobs that your published deploy depends on. 

As mentioned above, build plugins and file-based uploads must write to deploy-specific stores. This requirement makes it so that a deploy that fails cannot overwrite production data. 

To make a deploy-specific namespace with the Netlify Blobs API, use the `getDeployStore` method. 

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Generating a unique key for the entry.
  const key = uuid();

  const uploads = getDeployStore("file-uploads");
  await uploads.set(key, await req.text());

  return new Response(`Entry added with key ${key}`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Generating a unique key for the entry.
  const key = uuid();

  const uploads = getDeployStore("file-uploads");
  await uploads.set(key, await req.text());

  return new Response(`Entry added with key ${key}`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  // Reading a file from disk at build time.
  const file = await readFile("some-file.txt", "utf8");

  const uploads = getDeployStore("file-uploads");
  await uploads.set(key, file);

  console.log(`Entry added with key ${key}`);
};
```
</TabItem>

In general, blobs in deploy-specific stores are managed by Netlify like other atomic deploy assets. This means they're kept in sync with their relative deploys if you do a [rollback](/deploy/manage-deploys/manage-deploys-overview#rollbacks) and that they're cleaned up with [automatic deploy deletion](/deploy/manage-deploys/manage-deploys-overview#automatic-deploy-deletion). 

However, [downloading a deploy](/deploy/manage-deploys/manage-deploys-overview#download-a-deploy) does not download deploy-specific blobs, and [locking a published deploy](/deploy/manage-deploys/manage-deploys-overview#lock-a-published-deploy) does not prevent you from writing to associated deploy-specific stores. 

### Regions

By default, deploy-specific stores are located in the same region that your functions have been configured to run in. For a list of available regions, check out  these [region docs](/build/functions/optional-configuration#region). 

You can also manually specify which region to connect to, regardless of your function's region, by passing the region as an option when using the `getDeployStore` method. 

### Tabs Component:

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  // Generating a unique key for the entry.
  const key = uuid();

  const uploads = getDeployStore({ name: "file-uploads", region: "ap-southeast-2" });
  await uploads.set(key, await req.text());

  return new Response(`Entry added with key ${key}`);
};
```
</TabItem>

<TabItem label="edge function">
``` ts

export default async (req: Request, context: Context) => {
  // Generating a unique key for the entry.
  const key = uuid();

  const uploads = getDeployStore({ name: "file-uploads", region: "ap-southeast-2" });
  await uploads.set(key, await req.text());

  return new Response(`Entry added with key ${key}`);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  // Reading a file from disk at build time.
  const file = await readFile("some-file.txt", "utf8");

  const uploads = getDeployStore({ name: "file-uploads", region: "ap-southeast-2" });
  await uploads.set(key, file);

  console.log(`Entry added with key ${key}`);
};
```
</TabItem>

## Requirements and limitations

Keep the following requirements in mind while working with Netlify Blobs:

- Netlify Blobs uses the [web platform `fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to make HTTP calls, so Fetch API support is required. This is included with Node.js 18. If for some reason you can't use Node.js 18, you can provide your own Fetch API support by supplying a `fetch` property to the `getStore` or `getDeployStore` method.
- File-based uploads require [continuous deployment](/deploy/create-deploys#deploy-with-git) or [CLI deploys](/api-and-cli-guides/cli-guides/get-started-with-cli#manual-deploys).

### Collapsible Component:

**Custom fetch examples**

<Tabs>

<TabItem label="function">
``` ts

export default async (req: Request, context: Context) => {
  const uploads = getStore({ fetch, name: "file-uploads" });
  const entry = await uploads.get("my-key");

  return new Response(entry);
};
```
</TabItem>

<TabItem label="build plugin">
``` js

export const onPostBuild = async () => {
  const uploads = getDeployStore({
    name: "file-uploads",
    fetch
  });
  const entry = await uploads.get("my-key");

  console.log(entry);
};
```
</TabItem>

</Tabs>

---

Keep the following rules in mind when creating namespaces and blobs:

- Store names cannot include the `/` character.
- Store names cannot include the `:` character.
- Store names cannot exceed 64 bytes.
- Empty keys are not supported.
- Object keys can include any Unicode characters.
- Object keys cannot start with the `/` character.
- Object keys cannot exceed 600 bytes.
- An individual object's total size cannot exceed 5 GB.
- An individual object's metadata size cannot exceed 2 KB.

### Tip - Most characters use 1 byte

Most Unicode characters with UTF-8 encoding take 1 byte. So, for convenience, you can think of the above size limits as roughly a 64-character limit for store names and a 600-character limit for object keys. But, be aware that some characters take more than one byte. For example, `à` takes 2 bytes.

Keep the following limitations in mind when working with Netlify Blobs:

- Functions written in Go cannot access Netlify Blobs. 
- Local development with Netlify Dev uses a sandboxed local store that does not support [file-based uploads](#file-based-uploads). You cannot read production data during local development. 
- [Deploy deletion](/deploy/manage-deploys/manage-deploys-overview#automatic-deploy-deletion) deletes deploy-specific stores only. For other stores, you can create [custom expiration logic](#expiration-logic) or [delete objects manually](#delete) as needed. 
- Netlify Blobs is not currently supported as part of our HIPAA-compliant hosting offering. For more information, visit our [Trust Center](https://trust-center.netlify-corp.com) and download our reference architecture for HIPAA-compliant composable sites on Netlify.

## Troubleshooting tips

- **Last write wins.** If two overlapping calls try to write the same object, the last write wins. Netlify Blobs does not include a concurrency control mechanism. To manage the potential for race conditions, you can build an object-locking mechanism into your application.
- **Store access depends on `@netlify/blobs` module version.** If you wrote to site-wide stores with `@netlify/blobs` version 6.5.0 or earlier, and you then upgrade the module to a more recent version, you will no longer be able to access data in those stores. This is due to an internal change to namespacing logic. You can migrate affected stores by running the following command in the project directory using the latest version of the [Netlify CLI](/api-and-cli-guides/cli-guides/get-started-with-cli). 

   ```sh
   netlify recipes blobs-migrate YOUR_STORE_NAME
   ```
   This makes the migrated store accessible with `@netlify/blobs` module version 7.0.0 and later.