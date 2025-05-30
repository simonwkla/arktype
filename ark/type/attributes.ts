import type { ArkError, ArkErrors, Morph } from "@ark/schema"
import {
	noSuggest,
	type anyOrNever,
	type array,
	type Brand,
	type equals,
	type Hkt,
	type intersectArrays,
	type isSafelyMappable,
	type merge,
	type optionalKeyOf,
	type Primitive,
	type show,
	type unionKeyOf,
	type unionToTuple
} from "@ark/util"
import type { arkPrototypes } from "./keywords/constructors.ts"
import type { type } from "./keywords/keywords.ts"
import type { Type } from "./type.ts"
export type { arkPrototypes as object } from "./keywords/constructors.ts"

export type Comparator = "<" | "<=" | ">" | ">=" | "=="

export type RegexLiteral<source extends string = string> = `/${source}/`

export type DateLiteral<source extends string = string> =
	| `d"${source}"`
	| `d'${source}'`

export type LimitLiteral = number | DateLiteral

export type normalizeLimit<limit> =
	limit extends DateLiteral<infer source> ? source
	: limit extends number | string ? limit
	: never

export type distill<
	t,
	endpoint extends distill.Endpoint
> = finalizeDistillation<t, _distill<t, endpoint>>

export declare namespace distill {
	export type Endpoint = "in" | "out" | "out.introspectable"

	export type In<t> = distill<t, "in">

	export type Out<t> = distill<t, "out">

	export namespace introspectable {
		export type Out<t> = distill<t, "out.introspectable">
	}
}

type finalizeDistillation<t, distilled> =
	equals<t, distilled> extends true ? t : distilled

type _distill<t, endpoint extends distill.Endpoint> =
	// ensure optional keys don't prevent extracting defaults
	t extends undefined ? t
	: [t] extends [anyOrNever] ? t
	: unknown extends t ? unknown
	: t extends Brand<infer base> ?
		endpoint extends "in" ?
			base
		:	t
	: // Function is excluded from TerminallyInferredObjectKind so that
	// those types could be inferred before checking for morphs
	t extends TerminallyInferredObject | Primitive ? t
	: t extends Function ?
		// don't treat functions like () => never as morphs
		t extends (...args: never) => anyOrNever ? t
		: t extends InferredMorph<infer i, infer o> ? distillIo<i, o, endpoint>
		: t
	: t extends Default<infer constraint> ? _distill<constraint, endpoint>
	: t extends array ? distillArray<t, endpoint>
	: isSafelyMappable<t> extends true ? distillMappable<t, endpoint>
	: t

type distillMappable<o, endpoint extends distill.Endpoint> =
	endpoint extends "in" ?
		show<
			{
				// this is homomorphic so includes parsed optional keys like "key?": "string"
				[k in keyof o as k extends inferredDefaultKeyOf<o> ? never
				:	k]: _distill<o[k], endpoint>
			} & {
				[k in inferredDefaultKeyOf<o>]?: _distill<o[k], endpoint>
			}
		>
	:	{ [k in keyof o]: _distill<o[k], endpoint> }

type distillIo<i, o extends Out, endpoint extends distill.Endpoint> =
	endpoint extends "out" ? _distill<o["t"], endpoint>
	: endpoint extends "in" ? _distill<i, endpoint>
	: // out.introspectable only respects To (schema-validated output)
	o extends To<infer validatedOut> ? _distill<validatedOut, endpoint>
	: unknown

type unwrapInput<t> =
	t extends InferredMorph<infer i> ?
		t extends anyOrNever ?
			t
		:	i
	:	t

type inferredDefaultKeyOf<o> =
	keyof o extends infer k ?
		k extends keyof o ?
			unwrapInput<o[k]> extends Default<infer t> ?
				[t] extends [anyOrNever] ?
					never
				:	k
			:	never
		:	never
	:	never

type distillArray<t extends array, endpoint extends distill.Endpoint> =
	// fast path for non-tuple arrays with no extra props
	// this also allows TS to infer certain recursive arrays like JSON
	t[number][] extends t ? alignReadonly<_distill<t[number], endpoint>[], t>
	:	distillNonArraykeys<
			t,
			alignReadonly<distillArrayFromPrefix<[...t], endpoint, []>, t>,
			endpoint
		>

type alignReadonly<result extends unknown[], original extends array> =
	original extends unknown[] ? result : Readonly<result>

// re-intersect non-array props for a type like `{ name: string } & string[]`
type distillNonArraykeys<
	originalArray extends array,
	distilledArray,
	endpoint extends distill.Endpoint
> =
	keyof originalArray extends keyof distilledArray ? distilledArray
	:	distilledArray &
			_distill<
				{
					[k in keyof originalArray as k extends keyof distilledArray ? never
					:	k]: originalArray[k]
				},
				endpoint
			>

type distillArrayFromPrefix<
	t extends array,
	endpoint extends distill.Endpoint,
	prefix extends array
> =
	t extends readonly [infer head, ...infer tail] ?
		distillArrayFromPrefix<
			tail,
			endpoint,
			[...prefix, _distill<head, endpoint>]
		>
	:	[...prefix, ...distillArrayFromPostfix<t, endpoint, []>]

type distillArrayFromPostfix<
	t extends array,
	endpoint extends distill.Endpoint,
	postfix extends array
> =
	t extends readonly [...infer init, infer last] ?
		distillArrayFromPostfix<
			init,
			endpoint,
			[_distill<last, endpoint>, ...postfix]
		>
	:	[...{ [i in keyof t]: _distill<t[i], endpoint> }, ...postfix]

type BuiltinTerminalObjectKind = Exclude<
	arkPrototypes.NonDegenerateName,
	"Array" | "Function"
>

/** Objects we don't want to expand during inference like Date or Promise */
type TerminallyInferredObject =
	| arkPrototypes.instanceOf<BuiltinTerminalObjectKind>
	| ArkEnv.prototypes

export type inferPredicate<t, predicate> =
	predicate extends (data: any, ...args: any[]) => data is infer narrowed ?
		narrowed
	:	t

export type inferNaryPipe<morphs extends readonly Morph[]> = _inferNaryPipe<
	morphs,
	unknown
>

type _inferNaryPipe<remaining extends readonly unknown[], result> =
	remaining extends (
		readonly [infer head extends Morph, ...infer tail extends Morph[]]
	) ?
		_inferNaryPipe<tail, inferMorph<result, head>>
	:	result

export type inferNaryIntersection<types extends readonly unknown[]> =
	number extends types["length"] ?
		_inferNaryIntersection<unionToTuple<types[number]>, unknown>
	:	_inferNaryIntersection<types, unknown>

type _inferNaryIntersection<remaining extends readonly unknown[], result> =
	remaining extends readonly [infer head, ...infer tail] ?
		_inferNaryIntersection<tail, inferIntersection<result, head>>
	:	result

export type inferNaryMerge<types extends readonly unknown[]> =
	number extends types["length"] ? _inferUnorderedMerge<types>
	:	_inferNaryMerge<types, {}>

type _inferUnorderedMerge<
	types extends readonly unknown[],
	optionalKey extends PropertyKey = optionalAtLeastOnceUnionKeyOf<
		types[number]
	>,
	requiredKey extends PropertyKey = Exclude<
		unionKeyOf<types[number]>,
		optionalKey
	>
> = show<
	{
		[k in requiredKey]: types[number] extends infer v ?
			v extends unknown ?
				k extends keyof v ?
					v[k]
				:	never
			:	never
		:	never
	} & {
		[k in optionalKey]?: types[number] extends infer v ?
			v extends unknown ?
				k extends keyof v ?
					v[k]
				:	never
			:	never
		:	never
	}
>

/** Coalesce keys that exist and are optional on one or more branches of a union */
type optionalAtLeastOnceUnionKeyOf<t> =
	t extends unknown ? optionalKeyOf<t> : never

type _inferNaryMerge<remaining extends readonly unknown[], result> =
	remaining extends (
		readonly [infer head, ...infer tail extends readonly unknown[]]
	) ?
		_inferNaryMerge<tail, merge<result, head>>
	:	result

export type inferMorphOut<morph extends Morph> = Exclude<
	ReturnType<morph>,
	ArkError | ArkErrors
>

const isMorphOutKey = noSuggest("isMorphOut")

export interface Out<o = any> {
	[isMorphOutKey]: true
	t: o
	introspectable: boolean
}

export interface To<o = any> extends Out<o> {
	introspectable: true
}

export type InferredMorph<i = any, o extends Out = Out> = (In: i) => o

const defaultsToKey = noSuggest("defaultsTo")

export type Default<t = unknown, v = unknown> = { [defaultsToKey]: [t, v] }

// we have to distribute over morphs to preserve the i/o relationship
// this avoids stuff like:
// Default<boolean, true> => Default<true, true> | Default<false, true>
export type withDefault<t, v, undistributed = t> =
	t extends InferredMorph ? addDefaultToMorph<t, v>
	:	Default<Exclude<undistributed, InferredMorph>, v>

type addDefaultToMorph<t extends InferredMorph, v> =
	[normalizeMorphDistribution<t>] extends [InferredMorph<infer i, infer o>] ?
		(In: Default<i, v>) => o
	:	never

// will return `boolean` if some morphs are unequal
// so should be compared against `true`
type normalizeMorphDistribution<
	t,
	undistributedIn = t extends InferredMorph<infer i> ? i : never,
	undistributedOut extends Out = t extends InferredMorph<any, infer o> ?
		[o] extends [To<infer unwrappedOut>] ?
			To<unwrappedOut>
		:	o
	:	never
> =
	// using Extract here rather than distributing normally helps TS collapse the union
	// was otherwise getting duplicated branches, e.g.:
	// (In: boolean) => To<boolean> | (In: boolean) => To<boolean>
	// revert to `t extends InferredMorph...` if it doesn't break the tests in the future
	| (Extract<t, InferredMorph> extends anyOrNever ? never
	  : Extract<t, InferredMorph> extends InferredMorph<infer i, infer o> ?
			[undistributedOut] extends [o] ? (In: undistributedIn) => undistributedOut
			: [undistributedIn] extends [i] ?
				(In: undistributedIn) => undistributedOut
			:	t
	  :	never)
	| Exclude<t, InferredMorph> extends infer _ ?
		// needed to avoid normalizeMorphDistribution or similar showing up in finalized type
		_
	:	never

export type defaultFor<t = unknown> =
	| (Primitive extends t ? Primitive
	  : t extends Primitive ? t
	  : never)
	| (() => t)

export type termOrType<t> = t | Type<t, any>

export type inferIntersection<l, r> = normalizeMorphDistribution<
	_inferIntersection<l, r, false>
>

export type inferMorph<t, morph extends Morph> =
	morph extends type.cast<infer tMorph> ? inferPipe<t, tMorph>
	: inferMorphOut<morph> extends infer out ? (In: distill.In<t>) => Out<out>
	: never

export type inferPipe<l, r> = normalizeMorphDistribution<
	_inferIntersection<l, r, true>
>

type _inferIntersection<l, r, piped extends boolean> =
	[l & r] extends [infer t extends anyOrNever] ? t
	: l extends InferredMorph<infer lIn, infer lOut> ?
		r extends InferredMorph<any, infer rOut> ?
			piped extends true ?
				(In: lIn) => rOut
			:	// a commutative intersection between two morphs is a ParseError
				never
		: piped extends true ? (In: lIn) => To<r>
		: (In: _inferIntersection<lIn, r, false>) => lOut
	: r extends InferredMorph<infer rIn, infer rOut> ?
		(In: _inferIntersection<rIn, l, false>) => rOut
	: [l, r] extends [object, object] ?
		// adding this intermediate infer result avoids extra instantiations
		intersectObjects<l, r, piped> extends infer result ?
			result
		:	never
	:	l & r

interface MorphableIntersection<piped extends boolean>
	extends Hkt<[unknown, unknown]> {
	body: _inferIntersection<this[0], this[1], piped>
}

type intersectObjects<l, r, piped extends boolean> =
	l extends array ?
		r extends array ?
			intersectArrays<l, r, MorphableIntersection<piped>>
		:	// for an intersection with exactly one array operand like { name: string } & string[],
			// don't compute the intersection to avoid including prototype props
			l & r
	: r extends array ? l & r
	: show<
			// this looks redundant, but should hit the cache anyways and
			// preserves index signature + optional keys correctly
			{
				[k in keyof l]: k extends keyof r ?
					_inferIntersection<l[k], r[k], piped>
				:	l[k]
			} & {
				[k in keyof r]: k extends keyof l ?
					_inferIntersection<l[k], r[k], piped>
				:	r[k]
			}
		>
