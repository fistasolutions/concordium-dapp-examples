import { serializeTypeValue, toBuffer } from '@concordium/web-sdk';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { TxHashLink } from './CCDScanLinks';
import { WalletConnection, typeSchemaFromBase64 } from '@concordium/wallet-connectors';
import { CHANGE_ITEM_STATUS_PARAMETER_SCHEMA, SERIALIZATION_HELPER_SCHEMA_PERMIT_MESSAGE } from '../../constants';
import { Buffer } from 'buffer/';

async function generateMessage(newStatus: string, itemID: bigint, expiryTimeSignature: string, nonce: number | bigint) {
    try {
        // Create ChangeItemStatus parameter
        let changeItemStatusParameter = {
            additional_data: {
                bytes: [],
            },
            item_id: Number(itemID),
            new_status: {
                [newStatus]: [],
            },
        };

        const payload = serializeTypeValue(
            changeItemStatusParameter,
            toBuffer(CHANGE_ITEM_STATUS_PARAMETER_SCHEMA, 'base64')
        );

        const message = {
            contract_address: {
                index: Number(process.env.TRACK_AND_TRACE_CONTRACT_INDEX),
                subindex: 0,
            },
            nonce: Number(nonce),
            timestamp: expiryTimeSignature,
            entry_point: 'changeItemStatus',
            payload: Array.from(payload.buffer),
        };

        const serializedMessage = serializeTypeValue(
            message,
            toBuffer(SERIALIZATION_HELPER_SCHEMA_PERMIT_MESSAGE, 'base64')
        );

        return serializedMessage;
    } catch (error) {
        throw new Error(`Generating message failed. Orginal error: ${(error as Error).message}`);
    }
}

interface Props {
    connection: WalletConnection | undefined;
    accountAddress: string | undefined;
}

const NEW_STATUS_OPTIONS = [
    { label: 'Produced', value: 'Produced' },
    { label: 'InTransit', value: 'InTransit' },
    { label: 'InStore', value: 'InStore' },
    { label: 'Sold', value: 'Sold' },
];

export function ChangeItemStatus(props: Props) {
    const { connection, accountAddress } = props;

    type FormType = {
        itemID: bigint | undefined;
        newStatus: 'Produced' | 'InTransit' | 'InStore' | 'Sold' | undefined;
    };
    const { control, register, formState, handleSubmit } = useForm<FormType>({ mode: 'all' });

    const [newStatus, itemID] = useWatch({
        control: control,
        name: ['newStatus', 'itemID'],
    });

    const [txHash, setTxHash] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);

    async function onSubmit() {
        setError(undefined);

        if (newStatus === undefined) {
            throw Error(`'newStatus' undefined`);
        }
        if (itemID === undefined) {
            throw Error(`'itemID' undefined`);
        }

        // Signatures should expire in one day. Add 1 day to the current time.
        const date = new Date();
        date.setTime(date.getTime() + 86400 * 1000);

        // RFC 3339 format (e.g. 2030-08-08T05:15:00Z)
        const expiryTimeSignature = date.toISOString();

        if (connection && accountAddress) {
            try {
                const serializedMessage = await generateMessage(
                    newStatus,
                    itemID,
                    expiryTimeSignature,
                    0 // TODO: This should be the current nonce of the account.
                    // Track it at the database at the backend and get it form the database.
                );

                const permitSignature = await connection.signMessage(accountAddress, {
                    type: 'BinaryMessage',
                    value: Buffer.from(serializedMessage.buffer),
                    schema: typeSchemaFromBase64(SERIALIZATION_HELPER_SCHEMA_PERMIT_MESSAGE),
                });

                // TODO: Send signature to backend and submit transaction.
                // TODO: Send transaction hash to frontend
                console.log('Generate Signature:');
                console.log(permitSignature[0][0]);
                console.log('TODO: Send signature to backend.');
                setTxHash('TODO: Get transaction hash from backend');
            } catch (err) {
                setError((err as Error).message);
            }
        }
    }

    return (
        <div className="centered">
            <div className="card">
                <h2 className="centered"> Update The Product Status</h2>
                <br />
                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Form.Group className="col mb-3">
                        <Form.Label>Item ID</Form.Label>
                        <Form.Control {...register('itemID', { required: true })} placeholder="12345" />
                        {formState.errors.itemID && <Alert variant="info"> Item ID is required </Alert>}
                        <Form.Text />
                    </Form.Group>

                    <Form.Group className="col mb-3">
                        <Form.Label>New Status</Form.Label>
                        <Controller
                            name="newStatus"
                            control={control}
                            defaultValue={'InTransit'}
                            render={({ field: { onChange } }) => (
                                <Select
                                    getOptionValue={(option) => option.value}
                                    options={NEW_STATUS_OPTIONS}
                                    onChange={(e) => {
                                        onChange(e?.value);
                                    }}
                                />
                            )}
                        />
                    </Form.Group>

                    <Button variant="secondary" type="submit">
                        Update Status
                    </Button>
                </Form>

                {txHash && (
                    <Alert variant="info">
                        <TxHashLink txHash={txHash} />
                    </Alert>
                )}
                {error && <Alert variant="danger">{error}</Alert>}
            </div>
        </div>
    );
}
