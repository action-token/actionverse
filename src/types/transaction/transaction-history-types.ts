import { Horizon } from "@stellar/stellar-sdk";

export type TransactionHistoryTypes = {
    source: string;
    successful: boolean;
    ledger_attr: number;
    sequence: string;
    maxFee: string | number;
    createdAt: string;
    memo: string | undefined;
    id: string;
    pagingToken: string;
    envelopeXdr: string;
    resultXdr: string;
    resultMetaXdr: string;
    signatures: string[];
    fee_charged: string | number;
    operations: Horizon.ServerApi.OperationRecord[];
};